import axios from "axios";

export const ip = `https://api.infinity00.world`;
// export const ip = "http://10.10.55.97";


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
