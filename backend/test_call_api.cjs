
const fetch = require("node-fetch");

const BASE_URL = "http://localhost:3008";

async function login() {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "pace.jind@gmail.com", password: "test123" }),
  });

  const data = await res.json();
  console.log("Login response:", data);
  return data.token;
}

async function getStudents(token) {
  const res = await fetch(`${BASE_URL}/api/students`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  console.log("Students count:", data.length);
  console.log("First student:", data[0]);
}

async function main() {
  try {
    const token = await login();
    if (!token) {
      console.error("Login failed");
      return;
    }

    await getStudents(token);
  } catch (e) {
    console.error("Error:", e);
  }
}

main();

