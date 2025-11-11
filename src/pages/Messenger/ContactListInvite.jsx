import React, { useEffect, useState } from "react";
import { Accordion, ListGroup, Badge, Button } from "react-bootstrap";
import { caxios } from "../../config/config";
import styles from "./ContactListInvite.module.css";

export default function ContactListInvite({ roomId, onClose }) {
  const [members, setMembers] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);

  const userId = sessionStorage.getItem("LoginID");

  const departments = [
    { name: "연구개발", code: "연구개발" },
    { name: "사업관리", code: "사업관리" },
    { name: "AI센터", code: "AI센터" },
    { name: "인사과", code: "인사과" },
    { name: "재무/회계", code: "재무/회계" },
    { name: "마케팅팀", code: "마케팅팀" },
  ];

  const ranks = {
    J001: "사원",
    J002: "주임",
    J003: "대리",
    J004: "과장",
    J005: "차장",
    J006: "부장",
    J007: "이사",
    J008: "부사장",
    J009: "사장",
  };

  //  전체 멤버 조회 (본인 제외)
  useEffect(() => {
    caxios
      .get("/messenger/member")
      .then((resp) => setMembers(resp.data.filter((m) => m.id !== userId)))
      .catch(console.error);
  }, [userId]);

  //  선택 토글
  const toggleSelect = (id) => {
    setSelected((prev) => {
      const newSet = new Set(prev);
      newSet.has(id) ? newSet.delete(id) : newSet.add(id);
      return newSet;
    });
  };

  //  초대 실행
  const inviteSelected = async () => {
    if (!roomId) return alert("roomId 없음! 창을 닫고 다시 진입해주세요!");
    if (selected.size < 1) return alert("초대할 대상을 선택해주세요!");

    const memberQuery = Array.from(selected)
      .map((id) => `memberIds=${id}`)
      .join("&");

    try {
      setLoading(true);
      await caxios.post(`/api/chat/invite?roomId=${roomId}&${memberQuery}`);
     
      onClose();
    } catch (err) {
      console.error("초대 실패:", err.response?.data || err.message);
      alert(err.response?.data?.message || "서버 오류 발생");
    } finally {
      setLoading(false);
    }
  };

  //  부서별 + 직급 내림차순 정렬
  const getDeptMembers = (code) =>
    members
      .filter((m) => m.dept_code?.trim() === code)
      .sort((a, b) => {
        const numA = parseInt(a.rank_code?.substring(1) || "0");
        const numB = parseInt(b.rank_code?.substring(1) || "0");
        return numB - numA;
      });

  return (
    <div className={styles.container}>
      <Accordion alwaysOpen>
        {departments.map((dept, idx) => {
          const deptMembers = getDeptMembers(dept.code);
          return (
            <Accordion.Item eventKey={String(idx)} key={dept.code}>
              <Accordion.Header>
                {dept.name}
                <Badge bg="info" className="ms-2">
                  {deptMembers.length}
                </Badge>
              </Accordion.Header>

              <Accordion.Body>
                {deptMembers.length > 0 ? (
                  <ListGroup>
                    {deptMembers.map((m) => (
                      <ListGroup.Item
                        key={m.id}
                        action
                        active={selected.has(m.id)}
                        onClick={() => toggleSelect(m.id)}
                        className={styles.memberItem}
                      >
                        <div className={styles.memberInfo}>
                          <strong>{m.name}</strong>
                          <span className={styles.rankText}>
                            {ranks[m.rank_code] || ""}
                          </span>
                        </div>
                        {selected.has(m.id) && (
                          <span className={styles.check}>✔</span>
                        )}
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                ) : (
                  <div className={styles.noMember}>등록된 인원이 없습니다.</div>
                )}
              </Accordion.Body>
            </Accordion.Item>
          );
        })}
      </Accordion>

      <Button
        variant="primary"
        disabled={loading}
        className={styles.inviteButton}
        onClick={inviteSelected}
      >
        {loading ? "초대 중..." : `초대하기 (${selected.size})`}
      </Button>
    </div>
  );
}
