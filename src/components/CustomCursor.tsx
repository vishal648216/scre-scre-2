import React, { useEffect, useState, useMemo } from 'react';
import { usePublicSystemSettings } from '@/hooks/usePublicSystemSettings';

interface SystemSettings {
  cursor_url?: string;
  is_messaging_wall_enabled: boolean;
}

const CustomCursor = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPointer, setIsPointer] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isClicked, setIsClicked] = useState(false);

  const { data: raw, isLoading } = usePublicSystemSettings();
  const settings = raw as SystemSettings | null | undefined;

  const finalCursorUrl = useMemo(() => {
    if (!settings?.cursor_url) return null;
    
    return settings.cursor_url.startsWith('http') 
      ? settings.cursor_url 
      : `${window.location.origin}${settings.cursor_url}`;
  }, [settings?.cursor_url]);

  useEffect(() => {
    // Hide system cursor when custom cursor is active
    if (isVisible && (finalCursorUrl || !isLoading)) {
      document.body.style.cursor = 'none';
      // Also hide on all interactive elements
      if (!document.getElementById('hide-cursor')) {
        const style = document.createElement('style');
        style.id = 'hide-cursor';
        style.innerHTML = `
          * { cursor: none !important; }
        `;
        document.head.appendChild(style);
      }
    } else {
      document.body.style.cursor = 'auto';
      document.getElementById('hide-cursor')?.remove();
    }

    return () => {
      document.body.style.cursor = 'auto';
      document.getElementById('hide-cursor')?.remove();
    };
  }, [isVisible, finalCursorUrl, isLoading]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
      if (!isVisible) setIsVisible(true);
      
      const target = e.target as HTMLElement;
      setIsPointer(
        window.getComputedStyle(target).cursor === 'pointer' ||
        target.tagName === 'A' ||
        target.tagName === 'BUTTON' ||
        target.closest('button') !== null ||
        target.closest('a') !== null
      );
    };

    const onTouchStart = () => setIsVisible(false);

    const onMouseDown = () => setIsClicked(true);
    const onMouseUp = () => setIsClicked(false);
    const onMouseLeave = () => setIsVisible(false);
    const onMouseEnter = () => setIsVisible(true);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchstart', onTouchStart);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mouseleave', onMouseLeave);
    document.addEventListener('mouseenter', onMouseEnter);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('mouseenter', onMouseEnter);
    };
  }, [isVisible]);

  if (!isVisible || isLoading) return null;

  // IMPORTANT: If finalCursorUrl is present, ALWAYS show it. 
  // Do NOT fall back to the circle if we have an image URL.
  if (finalCursorUrl) {
    return (
      <div
        key={finalCursorUrl} // Force re-render when URL changes
        className={`fixed top-0 left-0 pointer-events-none z-[99999] transition-transform duration-150 ease-out -translate-x-1/2 -translate-y-1/2 ${
          isPointer ? 'scale-125' : isClicked ? 'scale-90' : 'scale-100'
        }`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: '32px',
          height: '32px',
          backgroundImage: `url("${finalCursorUrl}")`,
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
        }}
      />
    );
  }

  // Fallback circle ONLY if no cursor_url is set in settings
  return (
    <>
      <div
        className={`fixed top-0 left-0 w-8 h-8 rounded-full border-2 border-primary pointer-events-none z-[99999] transition-transform duration-150 ease-out -translate-x-1/2 -translate-y-1/2 ${
          isPointer ? 'scale-150 bg-primary/20' : isClicked ? 'scale-90 bg-primary/10' : 'scale-100'
        }`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
      />
      <div
        className={`fixed top-0 left-0 w-2 h-2 bg-primary rounded-full pointer-events-none z-[99999] -translate-x-1/2 -translate-y-1/2 transition-transform duration-100 ${
          isPointer ? 'scale-0' : isClicked ? 'scale-75' : 'scale-100'
        }`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
      />
    </>
  );
};

export default CustomCursor;
