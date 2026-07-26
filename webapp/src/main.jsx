import React from "react";
import ReactDOM from "react-dom/client";

// 화면은 web 과 같은 코드 한 벌. appMode 로 레이아웃만 폰 폭에 맞춘다.
import App from "../../web/src/App.jsx";
import "../../web/src/index.css";
import "./app.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App appMode />
  </React.StrictMode>,
);
