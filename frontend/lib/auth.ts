import api from "./api";

export async function login(email: string, password: string) {
  const params = new URLSearchParams();
  params.append("username", email);
  params.append("password", password);

  const res = await api.post(
    "/api/auth/login",
    params,
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  const { access_token } = res.data;

  if (typeof window !== "undefined") {
    localStorage.setItem("access_token", access_token);
  }

  return access_token;
}
