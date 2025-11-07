import axios from "axios";

export const ip = `http://10.5.5.11`;

export const caxios = axios.create({
  baseURL: ip
});


caxios.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("token");
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});
