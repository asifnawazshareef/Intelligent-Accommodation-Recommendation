import { toast } from "sonner";

const withAction = (type, message, { description, action, duration = 6000, ...rest } = {}) => {
  toast[type](message, {
    description,
    duration,
    ...(action
      ? {
          action: {
            label: action.label,
            onClick: action.onClick,
          },
        }
      : {}),
    ...rest,
  });
};

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
  withAction,
};

export default notify;
