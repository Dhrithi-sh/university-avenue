"use client";

export function DeleteArticleButton() {
  return <button
    className="review-delete-action"
    type="submit"
    onClick={event => {
      if (!window.confirm("Permanently delete this story and its editorial history? This cannot be undone.")) {
        event.preventDefault();
      }
    }}
  >Delete permanently</button>;
}
