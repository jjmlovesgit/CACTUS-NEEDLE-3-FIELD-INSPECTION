import { z } from 'zod';

export const EquipmentInspectionSchema = z.object({
  unit_id: z
    .string()
    .min(1, "Asset ID required")
    .describe("Alphanumeric machine tag, e.g. 'PUMP-104' or 'GEN-12'"),
  status: z
    .enum(["PASS", "NEEDS_MAINTENANCE", "CRITICAL_FAIL"])
    .describe("Operational readiness assessment"),
  temperature_c: z
    .number()
    .min(-40)
    .max(250)
    .describe("Surface temperature in Celsius"),
  vibration_ips: z
    .number()
    .min(0.0)
    .max(5.0)
    .describe("Vibration velocity in inches per second"),
  emergency_stop_tested: z
    .boolean()
    .describe("Whether physical emergency stop switch was tested"),
  inspector_notes: z
    .string()
    .optional()
    .describe("Observations regarding noise, leaks, wear, or field notes"),
});

export type EquipmentInspectionFormValues = z.infer<typeof EquipmentInspectionSchema>;

// OpenAI Function Specification format required by Needle 3 WASM tokenizer
export const needleInspectionTool = {
  type: "function",
  function: {
    name: "record_equipment_inspection",
    description: "Log or update machinery inspection telemetry parameters including temperature, vibration, status, asset tag, e-stop test, and inspector notes.",
    parameters: {
      type: "object",
      properties: {
        unit_id: {
          type: "string",
          description: "Alphanumeric machine asset tag, e.g. PUMP-104 or GEN-12."
        },
        status: {
          type: "string",
          enum: ["PASS", "NEEDS_MAINTENANCE", "CRITICAL_FAIL"],
          description: "Operational readiness assessment: PASS, NEEDS_MAINTENANCE, or CRITICAL_FAIL."
        },
        temperature_c: {
          type: "number",
          description: "Surface temperature in Celsius (-40 to 250)."
        },
        vibration_ips: {
          type: "number",
          description: "Vibration velocity in inches per second (0.0 to 5.0)."
        },
        emergency_stop_tested: {
          type: "boolean",
          description: "Whether physical emergency stop switch was tested."
        },
        inspector_notes: {
          type: "string",
          description: "Inspector observations and field notes."
        }
      }
    }
  }
};

// Also export flat definition for fallback compatibility
export const needleInspectionToolFlat = {
  name: "record_equipment_inspection",
  description: "Log or update machinery inspection telemetry parameters including temperature, vibration, status, asset tag, e-stop test, and inspector notes.",
  parameters: needleInspectionTool.function.parameters
};
