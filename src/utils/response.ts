export const successResponse = (data: unknown, message = "Success") => ({
  status: "success",
  message,
  data,
})

export const errorResponse = (message: string, errors?: unknown) => ({
  status: "error",
  message,
  errors: errors ?? null,
})