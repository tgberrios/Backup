export interface ApiError {
  error: string;
  details?: string;
  code?: string;
}

export const extractApiError = (error: unknown): string => {
  if (error && typeof error === "object" && "response" in error) {
    const axiosError = error as { response?: { data?: ApiError } };
    if (axiosError.response?.data) {
      return (
        axiosError.response.data.details ||
        axiosError.response.data.error ||
        "An error occurred"
      );
    }
  }
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An unexpected error occurred";
};
