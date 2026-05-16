export type { Profile, Session, User, AuthError } from "./types";
export {
  getSession,
  getProfile,
  requireAuth,
  requireAdmin,
  signInWithEmail,
  signInWithGoogle,
  signOut,
} from "./service";
