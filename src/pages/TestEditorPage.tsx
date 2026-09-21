import React from "react";

const TestEditorPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="w-[800px] h-[1132px] bg-white mx-auto shadow-2xl p-8">
        <div
          contentEditable
          dir="ltr"
          style={{
            fontSize: "24px",
            textAlign: "center",
            direction: "ltr",
            unicodeBidi: "normal",
            writingMode: "horizontal-tb",
          }}
          className="w-full h-full outline-none"
          placeholder="Start typing here..."
        >
          Start typing here...
        </div>
      </div>
    </div>
  );
};

export default TestEditorPage;
