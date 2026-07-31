"use client";

import { useState } from "react";
import { licenseOptions } from "@/lib/licenses";

const otherValue = "other";

export function LicenseSelector({
  name = "license",
  defaultValue = "auto",
}: {
  name?: string;
  defaultValue?: string;
}) {
  const known = licenseOptions.some((item) => item.value === defaultValue);
  const [choice, setChoice] = useState(known ? defaultValue : otherValue);
  const [customValue, setCustomValue] = useState(known ? "" : defaultValue);
  const description = choice === otherValue
    ? "填写仓库实际使用的 SPDX 标识或协议名称，例如 CC-BY-4.0、WTFPL。"
    : licenseOptions.find((item) => item.value === choice)?.description;

  return (
    <div className="license-selector">
      <select value={choice} onChange={(event) => setChoice(event.target.value)}>
        {licenseOptions.map((license) => (
          <option value={license.value} key={license.value}>{license.label}</option>
        ))}
        <option value={otherValue}>其他协议（手动填写）</option>
      </select>
      {choice === otherValue && (
        <input
          value={customValue}
          onChange={(event) => setCustomValue(event.target.value)}
          required
          maxLength={80}
          placeholder="例如：CC-BY-4.0"
        />
      )}
      <input type="hidden" name={name} value={choice === otherValue ? customValue : choice} />
      <small className="field-help">{description}</small>
    </div>
  );
}
