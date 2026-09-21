import { useCallback, useEffect, useRef } from "react";
import { Bold, Italic, Link as LinkIcon, List, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
};

/** Minimal HTML editor for trusted admin content (full HTML stored in DB). */
export function CourseRichTextEditor({ value, onChange, placeholder, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || syncing.current) return;
    if (el.innerHTML !== value) {
      el.innerHTML = value || "";
    }
  }, [value]);

  const emit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    syncing.current = true;
    onChange(el.innerHTML);
    queueMicrotask(() => {
      syncing.current = false;
    });
  }, [onChange]);

  const cmd = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  };

  const setLink = () => {
    const url = window.prompt("Link URL (https://…)", "https://");
    if (url) cmd("createLink", url);
  };

  return (
    <div className={cn("border border-border rounded-md overflow-hidden bg-background", className)}>
      <div className="flex flex-wrap gap-1 p-2 border-b border-border bg-muted/30">
        <button type="button" className="p-2 rounded hover:bg-muted" onClick={() => cmd("bold")} title="Bold">
          <Bold className="w-4 h-4" />
        </button>
        <button type="button" className="p-2 rounded hover:bg-muted" onClick={() => cmd("italic")} title="Italic">
          <Italic className="w-4 h-4" />
        </button>
        <button type="button" className="p-2 rounded hover:bg-muted" onClick={() => cmd("insertUnorderedList")} title="Bullet list">
          <List className="w-4 h-4" />
        </button>
        <button type="button" className="p-2 rounded hover:bg-muted" onClick={() => cmd("insertOrderedList")} title="Numbered list">
          <ListOrdered className="w-4 h-4" />
        </button>
        <button type="button" className="p-2 rounded hover:bg-muted" onClick={setLink} title="Insert link">
          <LinkIcon className="w-4 h-4" />
        </button>
      </div>
      <div
        ref={ref}
        className="min-h-[140px] max-h-[280px] overflow-y-auto px-3 py-2 text-sm prose prose-sm max-w-none focus:outline-none focus:ring-2 focus:ring-primary/20"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
      />
      <style>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: hsl(var(--muted-foreground));
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
