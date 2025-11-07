// src/config/NotificationSocket.jsx
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";
import { useEffect, useState } from "react";
import { caxios } from "./config";
import { ip } from "./config";

const NotificationSocket = () => {
  const [myInfo, setMyInfo] = useState(null);

  // 유저 정보 불러오기
  useEffect(() => {
    caxios.get("/member/me").then((res) => {
      setMyInfo(res.data);
    });
  }, []);

  //  알림 WebSocket 연결
  useEffect(() => {
    if (!myInfo?.id) return;

    console.log("알림 연결 시도:", myInfo.id);

     const client = Stomp.over(() => new SockJS(ip+"/ws-notice"));
    //const client = Stomp.over(() => new SockJS("http://192.168.219.108/ws-notice"));
    
    client.debug = () => {};
    client.reconnectDelay = 5000;

    client.connect({}, () => {
      console.log("✅ 알림 WebSocket 연결됨");
      console.log("🟢 개인 구독 경로:", `/notice/${myInfo.id}`);

      // 개인 알림 구독
      client.subscribe(`/notice/${myInfo.id}`, (msg) => {
        const data = JSON.parse(msg.body);
        console.log("📩 새 알림:", data);

        window.dispatchEvent(
          new CustomEvent("new-notification", { detail: data })
        );
      });

      // 전체 공지 알림 구독
      client.subscribe(`/notice/all`, (msg) => {
        const data = JSON.parse(msg.body);
        console.log("📢 전체 알림:", data);

        window.dispatchEvent(
          new CustomEvent("new-notification", { detail: data })
        );
      });
    });

    // 컴포넌트 언마운트 시 연결 해제
    return () => {
      try {
        client.deactivate();
        console.log("🔴 알림 WebSocket 해제됨");
      } catch (err) {
        console.warn("알림 소켓 해제 중 오류:", err);
      }
    };
  }, [myInfo]);

  return null;
};

export default NotificationSocket;
