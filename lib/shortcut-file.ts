import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

// Builds the "BoredBoard Music" Apple Shortcut for one user, with their token
// already in it, and signs it. iOS 15+ and macOS 12+ refuse unsigned shortcut
// files, and only macOS can sign them (the `shortcuts sign` command), so a
// personalised file can only be produced by a server running on a Mac.

const SHORTCUTS_CLI = "/usr/bin/shortcuts";

type PlistValue = string | number | boolean | PlistValue[] | { [key: string]: PlistValue };

const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function toPlist(value: PlistValue): string {
  if (typeof value === "string") return `<string>${escapeXml(value)}</string>`;
  if (typeof value === "number") return `<integer>${Math.trunc(value)}</integer>`;
  if (typeof value === "boolean") return value ? "<true/>" : "<false/>";
  if (Array.isArray(value)) return `<array>${value.map(toPlist).join("")}</array>`;
  return `<dict>${Object.entries(value)
    .map(([key, item]) => `<key>${escapeXml(key)}</key>${toPlist(item)}`)
    .join("")}</dict>`;
}

/** The workflow: current song → POST to BoredBoard → notification with the reply. */
export function buildShortcutPlist(endpoint: string, token: string) {
  const song = randomUUID().toUpperCase();
  const request = randomUUID().toUpperCase();
  const reply = randomUUID().toUpperCase();

  const text = (value: string) => ({ Value: { string: value }, WFSerializationType: "WFTextTokenString" });
  // "￼" is the placeholder Shortcuts replaces with the attached variable.
  const variable = (attachment: { [key: string]: PlistValue }) => ({
    Value: { string: "￼", attachmentsByRange: { "{0, 1}": attachment } },
    WFSerializationType: "WFTextTokenString",
  });
  const songProperty = (name: string) => ({
    Type: "ActionOutput",
    OutputUUID: song,
    OutputName: "Current Song",
    Aggrandizements: [{ Type: "WFPropertyVariableAggrandizement", PropertyName: name }],
  });
  const field = (key: string, value: PlistValue) => ({ WFItemType: 0, WFKey: text(key), WFValue: value });

  const workflow: PlistValue = {
    WFWorkflowActions: [
      { WFWorkflowActionIdentifier: "is.workflow.actions.getcurrentsong", WFWorkflowActionParameters: { UUID: song } },
      {
        WFWorkflowActionIdentifier: "is.workflow.actions.downloadurl",
        WFWorkflowActionParameters: {
          UUID: request,
          WFURL: endpoint,
          WFHTTPMethod: "POST",
          WFHTTPBodyType: "JSON",
          WFJSONValues: {
            Value: {
              WFDictionaryFieldValueItems: [
                field("title", variable(songProperty("Title"))),
                field("artist", variable(songProperty("Artist"))),
                field("token", text(token)),
                field("platform", text("apple")),
              ],
            },
            WFSerializationType: "WFDictionaryFieldValue",
          },
        },
      },
      {
        WFWorkflowActionIdentifier: "is.workflow.actions.getvalueforkey",
        WFWorkflowActionParameters: {
          UUID: reply,
          WFDictionaryKey: "message",
          WFInput: {
            Value: { Type: "ActionOutput", OutputUUID: request, OutputName: "Contents of URL" },
            WFSerializationType: "WFTextTokenAttachment",
          },
        },
      },
      {
        WFWorkflowActionIdentifier: "is.workflow.actions.notification",
        WFWorkflowActionParameters: {
          WFNotificationActionTitle: "BoredBoard",
          WFNotificationActionBody: variable({ Type: "ActionOutput", OutputUUID: reply, OutputName: "Dictionary Value" }),
        },
      },
    ],
    WFWorkflowName: "BoredBoard Music",
    WFWorkflowClientVersion: "2302.0.4",
    WFWorkflowMinimumClientVersion: 900,
    WFWorkflowMinimumClientVersionDescription: "iOS 14.0",
    WFWorkflowIcon: { WFWorkflowIconStartColor: 431817727, WFWorkflowIconGlyphNumber: 59511 },
    WFWorkflowImportQuestions: [],
    WFWorkflowInputContentItemClasses: [],
    WFWorkflowOutputContentItemClasses: [],
    WFWorkflowTypes: [],
    WFQuickActionSurfaces: [],
    WFWorkflowHasOutputFallback: false,
    WFWorkflowHasShortcutInputVariables: false,
  };

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">${toPlist(workflow)}</plist>
`;
}

/** Whether this server can sign shortcut files (macOS with the Shortcuts command). */
export async function canSignShortcuts() {
  if (process.platform !== "darwin") return false;
  try {
    await access(SHORTCUTS_CLI);
    return true;
  } catch {
    return false;
  }
}

/** Signs the workflow for "anyone" (installable on any device); returns the signed file. */
export async function signShortcut(plist: string): Promise<Buffer> {
  const folder = await mkdtemp(join(tmpdir(), "boredboard-shortcut-"));
  try {
    const input = join(folder, "unsigned.shortcut");
    const output = join(folder, "signed.shortcut");
    await writeFile(input, plist, "utf8");
    await promisify(execFile)(SHORTCUTS_CLI, ["sign", "--mode", "anyone", "--input", input, "--output", output], {
      timeout: 30_000,
    });
    return await readFile(output);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}
