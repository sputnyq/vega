import type { Response } from "express";

const RETENTION_DAYS = 30;

interface ArchivableDelegate<T> {
  update(args: { where: { id: string }; data: { archivedAt: Date | null; purgeAt: Date | null } }): Promise<T>;
}

/** Credit notes are archived individually with a 30-day purge date (ADR 0005). */
export function archiveRecord<T>(delegate: ArchivableDelegate<T>, id: string, archivedAt = new Date()): Promise<T> {
  return delegate.update({ where: { id }, data: { archivedAt, purgeAt: new Date(archivedAt.getTime() + RETENTION_DAYS * 86400000) } });
}

export function restoreRecord<T>(delegate: ArchivableDelegate<T>, id: string): Promise<T> {
  return delegate.update({ where: { id }, data: { archivedAt: null, purgeAt: null } });
}

export function fail(res: Response, status: number, code: string, message: string): void { res.status(status).json({ error: { code, message } }); }
export function isMissing(error: unknown) { return typeof error === "object" && error !== null && "code" in error && error.code === "P2025"; }
export function isUnique(error: unknown) { return typeof error === "object" && error !== null && "code" in error && error.code === "P2002"; }
