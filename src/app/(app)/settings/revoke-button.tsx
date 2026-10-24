"use client";

/** 撤銷前再確認一次：撤銷後用這組權杖的 Claude Code 會立刻連不上。 */
export function RevokeButton({ label }: { label: string }) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!window.confirm(`撤銷「${label}」？用這組權杖的 Claude Code 會立刻連不上，要重新產生一組。`)) e.preventDefault();
      }}
      className="text-sm font-bold text-danger underline underline-offset-2"
    >
      撤銷
    </button>
  );
}
