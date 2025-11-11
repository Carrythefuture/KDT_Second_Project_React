import React, { useEffect, useState } from "react";
import { Table, Input } from "antd";
import styles from "./BoardAnnouncement.module.css";
import { caxios } from "../../../config/config";
import { useLocation, useNavigate } from "react-router-dom";
import { StarFilled, StarOutlined } from "@ant-design/icons";

const { Search } = Input;

const BoardAnnouncement = () => {

  const navigate = useNavigate();
  const handleRowClick = (record) => {

    //조회수 증가
    caxios.post(`/board/detail/${record.key}/increment-view`);

    navigate(`/board/detail/${record.key}`, {
      state: { from: useLocation.pathname } // 현재 경로 저장
    });
  };
  const [search, setSearch] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const [data, setData] = useState([]);
  // 공지사항 (category_id = 1) 데이터 불러오기
  useEffect(() => {
    caxios
      .get("/board/category/1")
      .then((resp) => {
        console.log(resp.data);
        const mapped = resp.data.map((item) => {
          const dateToShow = item.updatedAt || item.createdAt;
          const createdAt = new Date(dateToShow);

          const formattedDate = `${createdAt.getFullYear()}-${String(
            createdAt.getMonth() + 1
          ).padStart(2, "0")}-${String(createdAt.getDate()).padStart(
            2,
            "0"
          )} ${String(createdAt.getHours()).padStart(2, "0")}:${String(
            createdAt.getMinutes()
          ).padStart(2, "0")}`;

          return {
            key: item.seq,
            tag: "사내",
            title: item.title,
            author: item.writer_id,
            date: formattedDate,
            importantYn: item.importantYn,
            hit: item.hit,
            noticeYn: item.noticeYn,
          };
        });

        setData(mapped);
      })
      .catch((err) => {
        console.error("게시글 목록 불러오기 실패:", err);
      });
  }, []);


  // 컬럼 정의
  const columns = [
    {
      title: <StarFilled style={{ color: "#fadb14", fontSize: "16px" }} />,
      key: "important", width: "10%",
      render: (_, record) => (
        <span
          onClick={(e) => {
            e.stopPropagation();
            handleImportant(record);
          }}
          style={{
            cursor: "pointer",
            color: record.importantYn === "Y" ? "#fadb14" : "#ccc",
            fontSize: "18px",
          }}
        >
          {record.importantYn === "Y" ? <StarFilled /> : <StarOutlined />}
        </span>
      ),
    },
    {
      title: "",
      dataIndex: "notice",
      key: "notice",
      width: "10%",
      render: (_, record) => (
        record.noticeYn === "Y" && (
          <span
            style={{
              backgroundColor: "#ffecb3",
              color: "#d48806",
              fontWeight: "bold",
              borderRadius: "4px",
              padding: "2px 6px",
              alignItems: "center",
              fontSize: "12px",
            }}
          >
            공지
          </span>
        )
      ),
    },
    {
      title: "제목",
      dataIndex: "title",
      key: "title",
      width: "40%",
      align: "left",
      className: "col-title", // ✅ 추가 가능
      render: (text) => (
        <span style={{ marginLeft: "15px" }}>{text}</span>
      ),
    },
    { title: "작성자", dataIndex: "author", key: "author", width: "20%" },
    { title: "조회수", dataIndex: "hit", key: "hit", width: "10%" },
    { title: "작성일", dataIndex: "date", key: "date", width: "20%" },
  ];
  // 중요 체크
  const handleImportant = async (record) => {
    try {
      await caxios.put(`/board/toggleImportant/${record.key}`);

      setData((prev) =>
        prev.map((item) =>
          item.key === record.key
            ? { ...item, importantYn: item.importantYn === "Y" ? "N" : "Y" }
            : item
        )
      );
    } catch (err) {
      console.error("중요 여부 변경 실패:", err);
    }
  };

  // 페이지 변경 시 실행 함수
  const handlePageChange = (page, pageSize) => {
    console.log("현재 페이지:", page);
    console.log("페이지당 항목 수:", pageSize);
    setSelectedRowKeys([]);
  };

  // 행 선택 기능
  const rowSelection = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys),
  };

  // 검색 필터 적용
  const filteredData = data.filter((item) =>
    item.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.container}>
      <div className={styles.search}>
        <Search
          placeholder="검색어를 입력하세요"
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 400 }}
        />
      </div>
      <div className={styles.boardHeader}>
        <Table
          columns={columns}
          dataSource={filteredData}
          tableLayout="fixed"
          pagination={{
            position: ["bottomCenter"],
            hideOnSinglePage: true,
            pageSizeOptions: ["5", "10", "20"],
            defaultPageSize: 10,
            onChange: handlePageChange,
          }}
          onRow={(record) => ({
            onClick: () => handleRowClick(record),
          })}
          rowClassName={() => styles.tableRow}
        />
      </div>
    </div>
  );
};

export default BoardAnnouncement;
