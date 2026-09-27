const messages: Record<string, string> = {
  "account-suspended": "This account is not currently active. Contact University Avenue for help.",
  image: "Enter a valid image URL beginning with http:// or https://.",
  load: "Your stories could not be loaded just now. Refresh the page and try again.",
  section: "Choose one of the available sections and try again.",
  save: "We couldn’t save that draft. Please try again.",
  submit: "We couldn’t submit this story. Refresh the page and try again.",
  "required-fields": "Add a title and dek before submitting your story.",
  "story-text": "Add at least one paragraph of story text before submitting.",
  "not-editable": "That story is unavailable or can no longer be edited.",
  admin: "You need an active administrator account to use the editorial desk.",
  delete: "That story could not be deleted. Check its status and try again.",
  "listing-delete": "That listing could not be deleted. Refresh the page and try again.",
  "note-length": "Reviewer notes must be 5,000 characters or fewer.",
  "note-required": "Add a note to explain the requested changes.",
  "sample-protected": "Sample listings are retained for visual testing and cannot be deleted.",
  "not-found": "That listing is unavailable or no longer exists.",
  review: "That editorial action could not be completed. Check the story status and try again.",
  "admin-required": "This page is for University Avenue administrators.",
  configuration: "Authentication is temporarily unavailable. Please try again later.",
  "invalid-credentials": "We couldn’t sign you in with those details.",
  "invalid-input": "Please check the fields and try again.",
  "invalid-password": "Choose a password of at least 8 characters and make sure both entries match.",
  "password-update-failed": "We couldn’t update your password. Request a fresh reset link and try again.",
  "reset-failed": "We couldn’t request a reset link. Please try again.",
  "reset-link-expired": "That password reset link has expired. Request a new one.",
  "signup-failed": "We couldn’t create your account. Check your details or try signing in.",
  "verification-failed": "That verification link could not be completed. Request a new link or sign in.",
};

const notices: Record<string, string> = {
  "check-email": "Check your email for a verification link. You can sign in after verifying your address.",
  "password-updated": "Your password has been updated. You can sign in with it now.",
  "reset-sent": "If an account uses that email, a password reset link is on its way.",
  "signed-out": "You have been signed out.",
  "draft-saved": "Draft saved. You can return to it at any time.",
  submitted: "Your story is now with the editors for review.",
  published: "The story has been published.",
  archived: "The story has been archived and removed from public listings.",
  rejected: "The story has been marked as rejected.",
  "changes-requested": "Changes have been requested. The contributor can now revise the story.",
  deleted: "The story and its editorial history have been permanently deleted.",
  created: "Listing created.",
  updated: "Listing updated.",
};

export function AuthNotice({ error, notice }: { error?: string; notice?: string }) {
  const errorMessage = error ? messages[error] : undefined;
  const noticeMessage = notice ? notices[notice] : undefined;

  if (errorMessage) return <p className="auth-notice auth-error" role="alert">{errorMessage}</p>;
  if (noticeMessage) return <p className="auth-notice" role="status">{noticeMessage}</p>;
  return null;
}
