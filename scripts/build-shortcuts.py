import plistlib, sys, uuid, copy
D = sys.argv[1]
U = lambda: str(uuid.uuid4()).upper()
QUESTION = {"Category": "Parameter", "DefaultValue": "", "ParameterKey": "WFTextActionText",
            "Text": "Colle ton code BoredBoard (site → page Raccourci → Afficher mon code)", "ActionIndex": 0}

def token_text_action():
    uid = U()
    return uid, {"WFWorkflowActionIdentifier": "is.workflow.actions.gettext",
                 "WFWorkflowActionParameters": {"UUID": uid, "WFTextActionText": ""}}

def ref(uid, name):
    return {"Value": {"string": "￼", "attachmentsByRange": {"{0, 1}": {"Type": "ActionOutput", "OutputName": name, "OutputUUID": uid}}},
            "WFSerializationType": "WFTextTokenString"}

def attach(uid, name):
    return {"Value": {"Type": "ActionOutput", "OutputName": name, "OutputUUID": uid}, "WFSerializationType": "WFTextTokenAttachment"}

def use_token(actions, text_uid):
    n = 0
    for a in actions:
        if a["WFWorkflowActionIdentifier"] != "is.workflow.actions.downloadurl": continue
        for item in a["WFWorkflowActionParameters"]["WFJSONValues"]["Value"]["WFDictionaryFieldValueItems"]:
            if item["WFKey"]["Value"]["string"] == "token":
                item["WFValue"] = ref(text_uid, "Texte"); n += 1
    assert n == 1, n

for name in ("main", "share"):
    p = plistlib.load(open(f"{D}/{name}.shortcut", "rb"))
    actions = p["WFWorkflowActions"]
    text_uid, text_action = token_text_action()
    use_token(actions, text_uid)
    if name == "share":
        dl = next(a for a in actions if a["WFWorkflowActionIdentifier"] == "is.workflow.actions.downloadurl")
        dl_uid = dl["WFWorkflowActionParameters"]["UUID"]
        share_uid, group = U(), U()
        copy_block = [
            {"WFWorkflowActionIdentifier": "is.workflow.actions.getvalueforkey",
             "WFWorkflowActionParameters": {"UUID": share_uid, "WFDictionaryKey": "share_url", "WFInput": attach(dl_uid, "Contenu de l’URL")}},
            {"WFWorkflowActionIdentifier": "is.workflow.actions.conditional",
             "WFWorkflowActionParameters": {"GroupingIdentifier": group, "WFControlFlowMode": 0, "WFCondition": 100,
                                            "WFInput": {"Type": "Variable", "Variable": attach(share_uid, "Valeur du dictionnaire")}}},
            {"WFWorkflowActionIdentifier": "is.workflow.actions.setclipboard",
             "WFWorkflowActionParameters": {"WFInput": attach(share_uid, "Valeur du dictionnaire")}},
            {"WFWorkflowActionIdentifier": "is.workflow.actions.conditional",
             "WFWorkflowActionParameters": {"GroupingIdentifier": group, "WFControlFlowMode": 1}},
            {"WFWorkflowActionIdentifier": "is.workflow.actions.setclipboard",
             "WFWorkflowActionParameters": {"WFInput": {"Value": {"Type": "ExtensionInput"}, "WFSerializationType": "WFTextTokenAttachment"}}},
            {"WFWorkflowActionIdentifier": "is.workflow.actions.conditional",
             "WFWorkflowActionParameters": {"GroupingIdentifier": group, "WFControlFlowMode": 2, "UUID": U()}},
        ]
        i = actions.index(dl) + 1
        actions[i:i] = copy_block
    actions.insert(0, text_action)
    p["WFWorkflowImportQuestions"] = [QUESTION]
    plistlib.dump(p, open(f"{D}/{name}-v2.shortcut", "wb"), fmt=plistlib.FMT_BINARY)
    print(name, "→", [a["WFWorkflowActionIdentifier"].split(".")[-1] for a in actions])
