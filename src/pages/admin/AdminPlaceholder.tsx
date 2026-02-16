import { useLocation } from "react-router-dom";

const fontStyle = { fontFamily: "Inter, Roboto, sans-serif" };

export default function AdminPlaceholder() {
  const { pathname } = useLocation();
  const section = pathname.split("/").pop() || "";

  return (
    <div style={fontStyle}>
      <div className="mb-6">
        <p className="text-xs mb-1" style={{ color: "hsl(220 9% 46%)" }}>Admin &gt; {section}</p>
        <h1 className="text-xl font-semibold capitalize" style={{ color: "hsl(220 13% 18%)" }}>
          {section}
        </h1>
      </div>
      <div
        className="rounded-md border p-8 text-center"
        style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}
      >
        <p className="text-sm" style={{ color: "hsl(220 9% 46%)" }}>
          Módulo em construção.
        </p>
      </div>
    </div>
  );
}
