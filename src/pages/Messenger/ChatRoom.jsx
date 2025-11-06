// src/pages/Messenger/ChatRoom.jsx
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useSearchParams } from "react-router-dom";
import styles from "./ChatRoom.module.css";
import { useSocket } from "../../config/SocketContext";
import { caxios } from "../../config/config";
import ContactListInvite from "./ContactListInvite";
import MessengerFileUpload from "./MessengerFileUpload";
import ChatMessageItem from "./ChatMessageItem"; // 메시지 아이템 컴포넌트

export default function ChatRoom() {
  // URL 파라미터
  const [params] = useSearchParams();
  const targetName = params.get("target") || "대화상대";
  const targetRank = params.get("rank") || "";
  const room_id = params.get("room_id") || params.get("roomId");

  // 소켓 관련 훅
  const { messages, sendMessage, subscribeRoom, setMessages, sendRead } = useSocket();

  const userId = sessionStorage.getItem("LoginID");

  // 상태 변수들
  const [menuOpen, setMenuOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState("");
  const [chromeOffset, setChromeOffset] = useState(0);
  const [input, setInput] = useState("");
  const [participants, setParticipants] = useState([]);
  const [fileList, setFileList] = useState([]);

  // ref
  const chatEndRef = useRef(null);
  const lastReadIdRef = useRef(null);

  // 메시지 목록
  const list = useMemo(() => messages[room_id] || [], [messages, room_id]);

  // 상위창 갱신 신호
  useEffect(() => {
    if (room_id)
      window.opener?.dispatchEvent(
        new CustomEvent("chatRoomUpdated", { detail: { roomId: room_id } })
      );
  }, [room_id]);

  //  참여자 목록 + 프로필 이미지 불러오기
  const fetchParticipants = useCallback(async () => {
    if (!room_id) return;
    try {
      const resp = await caxios.get(`/api/chat/members/${room_id}`);
      const rawParticipants = resp.data || [];

      // 각 멤버별 프로필 이미지 조회
      const withProfiles = await Promise.all(
        rawParticipants.map(async (p) => {
          try {
            const profileResp = await caxios.get(`/member/info/${p.memberId}`);
            const profile = profileResp.data;
            return {
              ...p,
              profileImageUrl: profile?.profileImage_servName
                ? `https://storage.googleapis.com/yj_study/${profile.profileImage_servName}`
                : "/defaultprofile.png",
            };
          } catch {
            return { ...p, profileImageUrl: "/defaultprofile.png" };
          }
        })
      );

      setParticipants(withProfiles);
    } catch (err) {
      console.error("참여자 목록 조회 실패:", err);
    }
  }, [room_id]);

  useEffect(() => {
    fetchParticipants();
  }, [room_id, fetchParticipants]);

  // 발신자 이름
  const getSenderInfo = useCallback(
    (senderId) => {
      const found = participants.find((p) => p.memberId === senderId);
      if (found) {
        return `${found.name}${found.rankName ? " " + found.rankName : ""}`;
      }
      return `${targetName}${targetRank ? " " + targetRank : ""}`;
    },
    [participants, targetName, targetRank]
  );

  //  발신자 프로필 이미지
  const getSenderImage = useCallback(
    (senderId) => {
      const found = participants.find((p) => p.memberId === senderId);
      return found?.profileImageUrl || "/defaultprofile.png";
    },
    [participants]
  );

  // 읽음 처리
  useEffect(() => {
    if (!room_id || !userId || list.length === 0) return;
    const last = list[list.length - 1];
    if (
      last.sender !== userId &&
      last.messageId &&
      last.messageId !== lastReadIdRef.current
    ) {
      sendRead(room_id, last.messageId, userId);
      lastReadIdRef.current = last.messageId;
      window.opener?.dispatchEvent(
        new CustomEvent("chatRoomUpdated", { detail: { roomId: room_id } })
      );
    }
  }, [list, room_id, userId, sendRead]);

  // 과거 메시지
  useEffect(() => {
    if (!room_id) return;
    let mounted = true;
    caxios.get(`/api/chat/messages/${room_id}`).then((resp) => {
      if (!mounted) return;
      const oldMsgs = resp.data || [];
      setMessages((prev) => ({ ...prev, [room_id]: oldMsgs }));
    });
    return () => {
      mounted = false;
    };
  }, [room_id, setMessages]);

  // 구독
  useEffect(() => {
    if (room_id) subscribeRoom(room_id);
  }, [room_id, subscribeRoom]);

  // 시간 포맷
  const formatTime = useCallback((t) => {
    if (!t) return "";
    return new Date(t).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }, []);

  // 메시지 전송
  const handleSend = useCallback(() => {
    if (!input.trim() || !userId || !room_id) return;
    sendMessage(room_id, { sender: userId, content: input, type: "TALK" });
    setInput("");
  }, [input, room_id, userId, sendMessage]);

  // 크롬 offset 계산
  useEffect(() => {
    setChromeOffset(window.outerHeight - window.innerHeight);
  }, []);

  // 스크롤 관리
  const isInitialScroll = useRef(true);
  const [isNearBottom, setIsNearBottom] = useState(true);

  useEffect(() => {
    const chatBox = document.querySelector(`.${styles.chatBox}`);
    if (!chatBox) return;

    const handleScroll = () => {
      const distanceFromBottom =
        chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight;
      setIsNearBottom(distanceFromBottom < 2);
    };

    chatBox.addEventListener("scroll", handleScroll);
    return () => chatBox.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (list.length === 0) return;
    const last = list[list.length - 1];

    if (isInitialScroll.current) {
      chatEndRef.current?.scrollIntoView({ behavior: "auto" });
      isInitialScroll.current = false;
      return;
    }

    if (last.sender === userId) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    if (isNearBottom) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [list, userId, isNearBottom]);

  // 사이드패널
  const openSidePanel = (mode) => {
    setPanelMode(mode);
    setPanelOpen(true);
    setMenuOpen(false);
    window.resizeTo(800, 550 + chromeOffset);
  };

  const closeSidePanel = () => {
    setPanelOpen(false);
    setPanelMode("");
    window.resizeTo(400, 550 + chromeOffset);
  };

  // 나가기
  const handleLeaveRoom = async () => {
    if (!room_id || !userId) return;

    try {
      const resp = await caxios.post("/api/chat/leave", null, {
        params: { roomId: room_id },
      });

      if (resp.status === 200) {
        window.opener?.dispatchEvent(
          new CustomEvent("chatRoomUpdated", { detail: { roomId: room_id } })
        );
        window.close();
      } else {
        alert("채팅방 나가기 실패");
      }
    } catch (err) {
      console.error(err);
      alert("오류가 발생했습니다.");
    }
  };

  // 파일 목록
  const fetchFileList = useCallback(async () => {
    if (!room_id) return;
    try {
      const resp = await caxios.get("/api/chat/files", {
        params: { roomId: room_id },
      });
      setFileList(resp.data);
    } catch (err) {
      console.error("파일 목록 조회 실패:", err);
    }
  }, [room_id]);

  useEffect(() => {
    if (panelMode === "files") fetchFileList();
  }, [panelMode, fetchFileList]);

  const handleDownload = async (file) => {
    try {
      const resp = await caxios.get(`/api/chat/download/${file.sysName}`, {
        responseType: "blob",
      });
      const blobUrl = window.URL.createObjectURL(new Blob([resp.data]));
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = file.originalName || "download";
      a.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("파일 다운로드 실패:", err);
      alert("파일을 찾을 수 없습니다.");
    }
  };

 
 // 드래그 앤 드롭 파일 업로드 핸들러
const handleGlobalDrop = useCallback(
  async (e) => {
    e.preventDefault(); // 기본 드롭 동작(파일이 브라우저 새 탭으로 열리는 것 등)을 막음

    // 드래그로 전달된 파일 목록을 배열 형태로 변환
    const files = Array.from(e.dataTransfer.files);

    // 파일이 없거나(room_id가 없으면) 업로드 중단
    if (!files.length || !room_id) return;

    try {
      // 로그인 토큰을 세션에서 가져옴
      const token = sessionStorage.getItem("token");

      // 여러 파일이 드롭된 경우 순차적으로 업로드 수행
      for (const file of files) {
        // multipart/form-data 전송을 위한 FormData 객체 생성
        const formData = new FormData();
        formData.append("file", file);      // 파일 데이터 첨부
        formData.append("roomId", room_id); // 업로드 대상 채팅방 ID 첨부

        // 서버에 파일 업로드 요청 (axios로 POST 전송)
        const resp = await caxios.post("/api/chat/upload", formData, {
          headers: {
            "Content-Type": "multipart/form-data",  // 파일 업로드용 Content-Type
            Authorization: `Bearer ${token}`,       // 인증 토큰 추가
          },
        });

        // 업로드 완료 후 서버 응답 데이터 (파일 이름, 저장 경로 등)
        const uploaded = resp.data;

        // 업로드된 파일 정보를 STOMP를 통해 해당 채팅방에 전송
        // → 다른 참가자들에게 “파일 메시지”로 전달됨
        sendMessage(room_id, {
          sender: userId,                   // 보낸 사람 ID
          content: uploaded.originalName,   // 파일 원래 이름
          fileUrl: uploaded.sysName,        // 서버에 저장된 실제 파일명(경로)
          type: "FILE",                     // 메시지 타입(FILE로 지정)
        });
      }

      // 파일 업로드 후, 채팅방의 파일 목록을 새로 불러옴
      fetchFileList();
    } catch (err) {
      // 업로드 중 예외가 발생했을 때 콘솔에 출력
      console.error("드래그앤드롭 파일 업로드 실패:", err);
    }
  },
  // useCallback 의존성 배열 — 이 값들 중 하나라도 변경되면 함수가 다시 생성됨
  [room_id, userId, sendMessage, fetchFileList]
);

  useEffect(() => {
    const preventDefault = (e) => e.preventDefault();
    window.addEventListener("dragover", preventDefault);
    window.addEventListener("drop", handleGlobalDrop);
    return () => {
      window.removeEventListener("dragover", preventDefault);
      window.removeEventListener("drop", handleGlobalDrop);
    };
  }, [handleGlobalDrop]);

  const chatTitle = useMemo(() => {
    if (participants.length > 0) {
      const names = participants
        .filter((p) => p.memberId !== userId)
        .map((p) => `${p.name}${p.rankName ? " " + p.rankName : ""}`);
      const uniqueNames = [...new Set(names)];
      return uniqueNames.join(", ") + " 님과의 대화";
    }
    return `${targetName}${targetRank ? " " + targetRank : ""} 님과의 대화`;
  }, [participants, userId, targetName, targetRank]);

  // 렌더링
  return (
    <div className={styles.popupContainer}>
      <div className={styles.topbar}>
        <div className={styles.chatTitle}>{chatTitle}</div>
        <div className={styles.menuContainer}>
          <span onClick={() => setMenuOpen(!menuOpen)}>≡</span>
          {menuOpen && (
            <div className={styles.dropdownMenu}>
              <button onClick={() => openSidePanel("members")}>
                대화상대 초대하기
              </button>
              <button onClick={() => openSidePanel("files")}>
                파일보내기/리스트
              </button>
              <button
                onClick={handleLeaveRoom}
                style={{
                  color: "red",
                  borderTop: "1px solid #ddd",
                  marginTop: "5px",
                }}
              >
                채팅방 나가기
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={styles.chatBox}>
        {list.map((msg, idx) => {
          if (msg.type === "SYSTEM") {
            return (
              <div key={idx} className={styles.systemMessage}>
                <span>{msg.content}</span>
              </div>
            );
          }

          const isMine = msg.sender === userId;
          const prevMsg = list[idx - 1];
          const isSameSender = prevMsg?.sender === msg.sender;
          const withinOneMin =
            prevMsg &&
            Math.abs(new Date(msg.sendTime) - new Date(prevMsg.sendTime)) <=
              60000;
          const hideProfile =
            isSameSender && withinOneMin && prevMsg?.sender !== userId;

          return (
            <ChatMessageItem
              key={msg.messageId || idx}
              msg={msg}
              isMine={isMine}
              hideProfile={hideProfile}
              getSenderInfo={getSenderInfo}
              profileImage={getSenderImage(msg.sender)} // ✅ 추가된 부분
              formatTime={formatTime}
              handleDownload={handleDownload}
            />
          );
        })}
        <div ref={chatEndRef} />
      </div>

      <div className={styles.chatInput}>
        <input
          type="text"
          placeholder="메시지를 입력하세요..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button onClick={handleSend}>전송</button>
      </div>

      {panelOpen && (
        <div className={styles.sidePanel}>
          <div className={styles.panelHeader}>
            <span>
              {panelMode === "files" ? "첨부파일 목록" : "대화상대 초대"}
            </span>
            <button className={styles.closeBtn} onClick={closeSidePanel}>
              X
            </button>
          </div>
          <div className={styles.panelBody}>
            {panelMode === "files" ? (
              <div className={styles.filePanel}>
                <MessengerFileUpload
                  roomId={room_id}
                  onUploadComplete={(uploaded) => {
                    if (uploaded && uploaded.sysName) {
                      sendMessage(room_id, {
                        sender: userId,
                        content: uploaded.originalName,
                        fileUrl: uploaded.sysName,
                        type: "FILE",
                      });
                      fetchFileList();
                      setPanelOpen(false);
                      setPanelMode("");
                      try {
                        window.resizeTo(400, 550 + chromeOffset);
                      } catch {}
                    }
                  }}
                />
                <div className={styles.fileList}>
                  {fileList.length === 0 ? (
                    <p className={styles.noFile}>첨부된 파일이 없습니다.</p>
                  ) : (
                    fileList.map((f, idx) => (
                      <div key={idx} className={styles.fileCard}>
                        <div className={styles.fileIcon}>
                          <i className="bi bi-file-earmark-text"></i>
                        </div>
                        <div className={styles.fileInfo}>
                          <span className={styles.fileName}>
                            {f.originalName}
                          </span>
                          <span className={styles.fileSize}>
                            {(f.size / 1024).toFixed(1)} KB
                          </span>
                        </div>
                        <button
                          onClick={() => handleDownload(f)}
                          className={styles.downloadBtn}
                        >
                          <i className="bi bi-download"></i>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <ContactListInvite
                roomId={room_id}
                onClose={() => {
                  closeSidePanel();
                  fetchParticipants();
                  window.opener?.dispatchEvent(
                    new CustomEvent("chatRoomUpdated", {
                      detail: { roomId: room_id },
                    })
                  );
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
