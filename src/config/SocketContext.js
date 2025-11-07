import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { ip } from "./config";
// 전역 소켓 컨텍스트 생성
// 리액트앱 전역 데이터 공유 통로 (파이프라인)
const SocketContext = createContext();

/**
 * SocketProvider
 * - STOMP 기반 WebSocket 연결을 관리하는 전역 Provider
 * - 연결, 구독, 메시지 전송, 읽음 처리 등을 중앙에서 관리
 */
function SocketProvider({ children }) {
  const [messages, setMessages] = useState({});  // 방별 메시지 저장 객체
  const clientRef = useRef(null);                // STOMP 클라이언트 인스턴스 저장
  const subscriptions = useRef({});              // 구독 중인 토픽 목록 저장용
  const pendingRoomId = useRef(null);            // 연결 전 대기 중인 구독 요청 보관용

  /**
   * WebSocket 연결 초기화
   * - SockJS를 통해 서버와 연결
   * - STOMP Client를 구성하고 연결 이벤트 핸들링
   */
  useEffect(() => {
    // 서버 주소는 환경에 맞게 설정
    const sock = new SockJS(ip+"/ws-chat");
    //const sock = new SockJS("http://192.168.219.108/ws-chat");
    

    // STOMP 클라이언트 인스턴스 생성
    clientRef.current = new Client({
      webSocketFactory: () => sock,
      reconnectDelay: 3000,  // 연결 끊김 시 재시도 딜레이 (ms)
      debug: (msg) => console.log("STOMP:", msg),

      /** STOMP 연결 성공 시 실행 */
      onConnect: () => {
        console.log("WebSocket Connected.");

        const userId = sessionStorage.getItem("LoginID");

        if (userId) {
          // 동일 사용자 구독이 이미 존재하면 다시 구독하지 않음 (중복 방지)
          if (subscriptions.current[`user_${userId}`]) {
            console.log(`이미 개인 구독 중: /topic/user/${userId}`);
          } else {
            try {
              // 개인 사용자 토픽 구독 (/topic/user/{userId})
              const sub = clientRef.current.subscribe(
                `/topic/user/${userId}`,
                (message) => {
                  let payload;
                  try {
                    payload = JSON.parse(message.body);
                  } catch {
                    return;
                  }

                  // 새 채팅방 생성 알림 (단순 목록 갱신만 수행)
                  if (payload.type === "NEW_ROOM") {
                    console.log("새 방 알림 수신:", payload);
                    window.dispatchEvent(new Event("refreshChatRooms"));
                    return;
                  }

                  // 상대방이 보낸 새 메시지 알림 처리
                  if (payload.type === "NEW_MESSAGE") {
                    const myId = sessionStorage.getItem("LoginID");

                    // 내가 보낸 메시지는 알림 제외
                    if (!myId || payload.sender === myId) return;

                    // 팝업창이 아닌 메인 창(부모)에서만 알림 발생
                    if (!window.opener) {
                      console.log("전역 알림 발생:", payload);
                      window.dispatchEvent(
                        new CustomEvent("globalMessengerNotify", {
                          detail: {
                            type: "NEW_MESSAGE",
                            roomId: payload.roomId,
                            sender: payload.sender,
                          },
                        })
                      );
                    }

                    // 채팅방 목록 새로고침 (읽지 않은 메시지 갱신용)
                    window.dispatchEvent(new Event("refreshChatRooms"));
                  }
                }
              );

              // 구독 정보를 기록 (중복 방지용)
              subscriptions.current[`user_${userId}`] = sub;
              console.log(`개인 구독 성공: /topic/user/${userId}`);
            } catch (err) {
              console.error("개인 구독 실패:", err);
            }
          }
        }

        // 연결 지연으로 인해 대기 중이던 구독 요청이 있다면 처리
        if (pendingRoomId.current) {
          subscribeRoom(pendingRoomId.current);
          pendingRoomId.current = null;
        }
      },

      /** STOMP 프로토콜 오류 발생 시 */
      onStompError: (frame) => {
        console.error("STOMP Error:", frame.headers["message"], frame.body);
      },

      /** WebSocket 연결 종료 시 */
      onWebSocketClose: () => {
        console.warn("WebSocket closed.");
      },
    });

    // WebSocket 연결 시작
    clientRef.current.activate();

    /** 언마운트 시 연결 및 구독 정리 */
    return () => {
      console.log("WebSocket Disconnected.");
      Object.values(subscriptions.current).forEach((s) => s.unsubscribe());
      clientRef.current?.deactivate();
    };
  }, []);

  /**
   * 메시지 전송
   * - 특정 방에 메시지를 전송 (STOMP SEND)
   */
  const sendMessage = (roomId, msg) => {
    if (!clientRef.current?.connected) {
      console.warn("STOMP 연결 전 - 메시지 전송 불가");
      return;
    }

    // 메시지 데이터 구성
    const payload = {
      ...msg,
      roomId,
      sendTime: new Date().toISOString(),
    };

    console.log("sendMessage payload:", payload);

    // 서버로 메시지 전송
    clientRef.current.publish({
      destination: `/app/chat/${roomId}`,
      body: JSON.stringify(payload),
    });
  };

  /**
   * 읽음 처리 전송
   * - 사용자가 메시지를 읽었을 때 서버로 알림 전송
   */
  const sendRead = (roomId, messageId, sender) => {
    if (!clientRef.current?.connected) return;

    clientRef.current.publish({
      destination: `/app/chat/read/${roomId}`,
      body: JSON.stringify({
        roomId,
        messageId,
        sender,
        type: "READ",
      }),
    });
  };

  /**
   * 채팅방 구독
   * - /topic/chatroom/{roomId} 토픽 구독
   * - 중복 구독 방지
   */
  const subscribeRoom = useCallback((roomId) => {
    if (!clientRef.current?.connected) {
      pendingRoomId.current = roomId;
      return;
    }

    // 이미 구독 중인 방이면 재구독하지 않음
    if (subscriptions.current[roomId]) {
      console.log(`이미 구독 중인 방: ${roomId}`);
      return;
    }

    // 방 구독 등록
    const sub = clientRef.current.subscribe(
      `/topic/chatroom/${roomId}`,
      (message) => {
        let body;
        try {
          body = JSON.parse(message.body);
        } catch (err) {
          console.error("메시지 파싱 실패:", err);
          return;
        }

        const msgType = body.type;

        // 메시지 상태 업데이트
        setMessages((prev) => {
          const prevList = prev[roomId] || [];

          // 읽음 상태 업데이트
          if (msgType === "READ" || msgType === "READ_UPDATE") {
            return {
              ...prev,
              [roomId]: prevList.map((m) =>
                m.messageId === body.messageId
                  ? { ...m, readCount: body.readCount }
                  : m
              ),
            };
          }

          // 일반 메시지 (대화, 파일, 입장, 시스템, 퇴장)
          if (["TALK", "FILE", "ENTER", "SYSTEM", "LEAVE"].includes(msgType)) {
            const exists = prevList.some((m) => m.messageId === body.messageId);

            if (exists) {
              return {
                ...prev,
                [roomId]: prevList.map((m) =>
                  m.messageId === body.messageId ? { ...m, ...body } : m
                ),
              };
            } else {
              return {
                ...prev,
                [roomId]: [...prevList, body],
              };
            }
          }

          return prev;
        });

        // TALK/FILE 메시지 수신 시 목록 갱신 이벤트 발생
        if (["TALK", "FILE"].includes(msgType)) {
          window.dispatchEvent(
            new CustomEvent("chatRoomUpdated", { detail: { roomId } })
          );
        }
      }
    );

    // 구독 목록에 등록
    subscriptions.current[roomId] = sub;
    console.log(`방 구독 성공: ${roomId}`);

    // 구독 해제 함수 반환
    return () => {
      try {
        sub.unsubscribe();
        delete subscriptions.current[roomId];
        console.log(`구독 해제 완료: ${roomId}`);
      } catch (err) {
        console.warn(`구독 해제 실패 (${roomId}):`, err);
      }
    };
  }, []);

  /**
   * Context value 제공
   * - 전역적으로 STOMP 기능과 메시지 상태를 공유
   */
  return (
    <SocketContext.Provider
      value={{
        messages,       // 방별 메시지 상태
        sendMessage,    // 메시지 전송 함수
        subscribeRoom,  // 방 구독 함수
        setMessages,    // 메시지 직접 갱신용
        sendRead,       // 읽음 처리 전송 함수
      }}
    >
      {children}
    </SocketContext.Provider> 
  );
}

/**
 * 커스텀 훅
 * - useSocket()으로 STOMP 관련 기능 접근 가능
 */
function useSocket() {
  return useContext(SocketContext);
}

export { SocketContext, SocketProvider, useSocket };
