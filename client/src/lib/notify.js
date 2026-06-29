import { toast } from "sonner";

export const notify = {
  success(message, options) {
    toast.success(message, options);
  },
  error(message, options) {
    toast.error(message, options);
  },
  warning(message, options) {
    toast.warning(message, options);
  },
  info(message, options) {
    toast.info(message, options);
  },
};

export default notify;
