import type { Request, Response } from "express";
import { updateUserSchema } from "./user.schema";
import * as userService from "./user.service";
import { successResponse, errorResponse } from "../../utils/response";
import { Role } from "@prisma/client";

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) { res.status(401).json(errorResponse("Unauthorized")); return; }
    const profile = await userService.getProfile(userId);
    res.status(200).json(successResponse(profile, "Profile fetched"));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to get profile";
    res.status(400).json(errorResponse(message));
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) { res.status(401).json(errorResponse("Unauthorized")); return; }
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(errorResponse("Validation error", parsed.error.flatten().fieldErrors));
      return;
    }
    const updated = await userService.updateProfile(userId, parsed.data, req.file);
    res.status(200).json(successResponse(updated, "Profile updated"));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update profile";
    res.status(400).json(errorResponse(message));
  }
};

export const getMyGames = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) { res.status(401).json(errorResponse("Unauthorized")); return; }
    const games = await userService.getUserGames(userId);
    res.status(200).json(successResponse(games, "Games fetched"));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to get games";
    res.status(400).json(errorResponse(message));
  }
};

// ============================================================
// ADMIN ONLY
// ============================================================

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const result = await userService.getAllUsers(req.query);
    res.status(200).json(successResponse(result, "Users fetched successfully"));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to get users";
    res.status(400).json(errorResponse(message));
  }
};

export const approveTeacher = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { action } = req.body as { action: string };

    if (!["APPROVE", "REJECT"].includes(action)) {
      res.status(400).json(errorResponse("Action harus APPROVE atau REJECT"));
      return;
    }

    const result = await userService.approveTeacher(id, action as "APPROVE" | "REJECT");
    const msg = action === "APPROVE"
      ? "Teacher berhasil di-approve"
      : "Teacher berhasil di-reject";
    res.status(200).json(successResponse(result, msg));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal memproses approval";
    res.status(400).json(errorResponse(message));
  }
};

export const changeUserRole = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { role } = req.body as { role: string };

    if (!role) {
      res.status(400).json(errorResponse("Role wajib diisi"));
      return;
    }

    const result = await userService.changeUserRole(id, role as Role);
    res.status(200).json(successResponse(result, "Role berhasil diubah"));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal mengubah role";
    res.status(400).json(errorResponse(message));
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const result = await userService.deleteUser(id);
    res.status(200).json(successResponse(result, "User deleted"));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete user";
    res.status(400).json(errorResponse(message));
  }
};