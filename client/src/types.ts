import { NotificationType } from 'vscode-languageclient';

// Status notifications
export interface StatusParams {
	id: number,
	state: string, // lint.start, lint.start.format, lint.start.fix ,lint.end, lint.end.format, lint.end.fix, lint.error, lint.cancel
	documents: [
		{
			documentUri: string,
			updatedSource?: string
		}];
	lastFileName?: string
	lastLintTimeMs?: number
}
export namespace StatusNotification {
	export const type = new NotificationType<StatusParams>('groovylintlsp/status');
}

// Active Document notifications to language server
export interface ActiveDocumentNotificationParams {
	uri: string
}
export namespace ActiveDocumentNotification {
	export const type = new NotificationType<ActiveDocumentNotificationParams>('groovylintlsp/activedocument');
}

// Open textDocument or Url notification
export interface OpenNotificationParams {
	file?: string,
	uri?: string,
	url?: string,
	preview?: boolean
}
export namespace OpenNotification {
	export const type = new NotificationType<OpenNotificationParams>("groovylintlsp/open");
}
