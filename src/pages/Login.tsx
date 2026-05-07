import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/", { replace: true, state: { openAuth: true } });
  }, [navigate]);

  return null;
}
