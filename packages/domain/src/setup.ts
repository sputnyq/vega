export interface SetupVariableDto {
  name: string;
  group: string;
  requirement: "required" | "optional" | "bootstrap";
  status: "set" | "missing" | "default";
  hint: string;
}

export interface SetupInfoDto {
  loaderUrl: string;
  embedCode: string;
  variables: SetupVariableDto[];
}

export interface SetupCheckDto {
  id: string;
  label: string;
  status: "ok" | "error" | "skipped";
  message: string;
}

export interface SetupSmokeTestDto {
  checkedAt: string;
  checks: SetupCheckDto[];
}
