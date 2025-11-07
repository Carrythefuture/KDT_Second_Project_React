import React, { useState } from "react";
import { Modal, Select, Input, Button } from "antd";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import ApprovalLineModal from "./ApprovalLineModal";
import { caxios } from "../../config/config";
import styles from "./style/LeaveModal.module.css";

const rankMap = {
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

const LeaveModal = ({ open, onClose, refresh, applicant }) => {
  const [vacType, setVacType] = useState("annual");
  const [vacReason, setVacReason] = useState("");
  const [selectedDates, setSelectedDates] = useState([]);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approverList, setApproverList] = useState([]);
  const [referenceList, setReferenceList] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isCEO = applicant?.rank_code === "J009";
  const today = new Date().toISOString().split("T")[0];

  const handleDateClick = (info) => {
    const date = info.dateStr;
    if (date < today) return alert("과거 날짜는 선택할 수 없습니다.");

    setSelectedDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]
    );
  };

  const dayCellClassNames = (arg) => {
    const date = arg.date.toISOString().split("T")[0];
    return date < today ? styles.pastDay : "";
  };

  const selectedEvents = selectedDates.map((d) => ({
    start: d,
    allDay: true,
    display: "background",
    backgroundColor: "#82b1ff",
  }));

    const sendTestNotice = async (receiver_id, type, message) => {
    await caxios.post("/notification/send", {
      receiver_id: receiver_id, // 실제 로그인 ID로 전달받을 사람.
      type: type,
      message: message,
      created_at: new Date().toISOString(),
    });
    //alert("테스트 알림 전송 완료 ✅");
  };

  // ✅ 모달에서 저장한 결재선 반영
  const applyApprovalLine = ({ approverList, referenceList }) => {
    setApproverList(approverList);
    setReferenceList(referenceList);
  };

 const submitVacation = async () => {
  if (isSubmitting) return;
  setIsSubmitting(true);

  if (!selectedDates.length) {
    setIsSubmitting(false);
    return alert("날짜를 선택해주세요.");
  }
  if (!vacReason.trim()) {
    setIsSubmitting(false);
    return alert("휴가 사유를 반드시 입력해야 합니다.");
  }
  if (!isCEO && !approverList.length) {
    setIsSubmitting(false);
    return alert("결재선을 설정해야 합니다.");
  }
  if ((vacType === "half_am" || vacType === "half_pm") && selectedDates.length !== 1) {
    setIsSubmitting(false);
    return alert("반차는 하루만 선택 가능합니다.");
  }
  if (vacType !== "half_am" && vacType !== "half_pm" && selectedDates.length > 5) {
    setIsSubmitting(false);
    return alert("휴가는 한 번에 최대 5일까지만 신청할 수 있습니다.");
  }

  const payload = {
    items: selectedDates.map((d) => ({ date: d, type: vacType, reason: vacReason })),
    approvers: approverList.map((a, idx) => ({ ...a, orderNo: idx + 1 })),
    references: referenceList,
  };

  try {
    await caxios.post("/leave/request", payload);

    const firstApproverId = approverList[0]?.id || approverList[0]?.member_id || approverList[0]?.userId;
    if (!isCEO && firstApproverId) {
      sendTestNotice(firstApproverId, "휴가 결재 요청", `${applicant.name}님의 휴가 결재 요청이 도착했습니다.`);
    }

    alert(isCEO ? "휴가가 정상적으로 등록되었습니다." : "휴가 신청 완료되었습니다.");
    onClose();
    refresh();
  } catch {
    alert("휴가 신청 실패");
  } finally {
    setIsSubmitting(false); 
  }
};
  return (
    <Modal open={open} onCancel={onClose} footer={null} width="75%">
      {!isCEO && (
        <div className={styles.approvalTableBox}>
          <div className={styles.approvalTableTitle}>
            <span>결재선</span>
            <Button size="small" type="primary" onClick={() => setApprovalModalOpen(true)}>
              + 결재선 설정
            </Button>
          </div>

          {/* ✅ 결재선 UI 표시 */}
          <div style={{ marginTop: 8, padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6 }}>
            {approverList.length > 0 ? (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ background: "#f5f5f5" }}>
                    <th style={{ padding: "6px", width: 60 }}>순번</th>
                    <th style={{ padding: "6px" }}>이름</th>
                    <th style={{ padding: "6px" }}>직급</th>
                    <th style={{ padding: "6px" }}>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {approverList.map((a, i) => (
                    <tr key={a.id}>
                      <td style={{ padding: "6px", textAlign: "center" }}>{i + 1}</td>
                      <td style={{ padding: "6px" }}>{a.name}</td>
                     <td style={{ padding: "6px" }}>{rankMap[a.rank_code] || a.rank_code}</td>
                      <td style={{ padding: "6px", color: "#666" }}>-</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ color: "#aaa" }}>결재선이 설정되지 않았습니다.</div>
            )}

            {referenceList.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 13, color: "#666" }}>
                <strong>참조:</strong> {referenceList.map((r) => r.name).join(", ")}
              </div>
            )}
          </div>
        </div>
      )}

      <div className={styles.selectedDateBox}>
        <strong>선택된 날짜:</strong> {selectedDates.length ? selectedDates.sort().join(", ") : "없음"}
      </div>

      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        dateClick={handleDateClick}
        events={selectedEvents}
        dayCellClassNames={dayCellClassNames}
        height={450}
        locale="ko"
      />

      <div style={{ marginTop: 20 }}>
        <Select
          value={vacType}
          onChange={setVacType}
          style={{ width: "100%", marginBottom: 10 }}
          options={[
            { value: "annual", label: "연차" },
            { value: "half_am", label: "오전 반차" },
            { value: "half_pm", label: "오후 반차" }
          ]}
        />

        <Input.TextArea
          placeholder="사유 입력"
          value={vacReason}
          onChange={(e) => setVacReason(e.target.value)}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <Button onClick={onClose}>취소</Button>
        <Button type="primary" onClick={submitVacation} disabled={isSubmitting}>
          {isSubmitting ? "처리중..." : "신청"}
        </Button>
      </div>

      {!isCEO && (
        <ApprovalLineModal
          open={approvalModalOpen}
          onClose={() => setApprovalModalOpen(false)}
          onApply={applyApprovalLine}
          initialApprovers={approverList}
          initialReferences={referenceList}
          applicant={applicant}
        />
      )}
    </Modal>
  );
};

export default LeaveModal;
