import PDFDocument from "pdfkit";
import type { orgImpact } from "./impact.js";
import { factors } from "./impact.js";

const GREEN = "#2e5e4e";
const HONEY = "#d9a23c";
const INK = "#1c1917";
const MUTED = "#57534e";

const CATEGORY: Record<string, string> = {
  leftovers: "Leftovers", fruit_veg: "Fruit & veg", bread: "Bread", packaged: "Packaged", dairy: "Dairy", other: "Other",
};
const ORG_TYPE: Record<string, string> = {
  food_bank: "Food bank", ngo: "NGO", charity: "Charity", community_center: "Community centre", school: "School", other: "Organization",
};
const num = (n: number) => n.toLocaleString("en-GB");

/** One-page A4 impact report for an organization (all-time and last 12 months, monthly chart, method). */
export function renderOrgReport(data: Awaited<ReturnType<typeof orgImpact>>, now = new Date()): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `${data.organization.name}: impact report`, Author: "FreshShare" } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const W = doc.page.width;
    const left = 48;
    const width = W - 96;

    // Header band
    doc.rect(0, 0, W, 96).fill(GREEN);
    doc.font("Helvetica-Bold").fontSize(22).fillColor("#ffffff").text("Fresh", left, 34, { continued: true }).fillColor(HONEY).text("Share");
    doc.font("Helvetica").fontSize(11).fillColor("#e3ede8").text("Impact report", left, 64);
    doc.text(now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }), left, 64, { width, align: "right" });

    // Title
    const o = data.organization;
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(20).text(o.name, left, 124, { width });
    doc.font("Helvetica").fontSize(11).fillColor(MUTED)
      .text([ORG_TYPE[o.type] ?? "Organization", o.city, o.verifiedAt ? `verified ${o.verifiedAt.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}` : null].filter(Boolean).join(" · "));

    // KPI tiles (all time)
    const tiles: [string, string][] = [
      [num(data.total.meals), "meals rescued"],
      [`${num(Math.round(data.total.kg))} kg`, "food kept out of the bin"],
      [`${num(Math.round(data.total.co2Kg))} kg`, "CO2e avoided"],
      [`${num(data.total.waterL)} L`, "water saved"],
    ];
    const tileW = (width - 3 * 10) / 4;
    let y = 186;
    doc.font("Helvetica-Bold").fontSize(12).fillColor(INK).text("All time", left, y);
    y += 20;
    tiles.forEach(([v, l], i) => {
      const x = left + i * (tileW + 10);
      doc.roundedRect(x, y, tileW, 70, 8).fill("#e3ede8");
      doc.fillColor(GREEN).font("Helvetica-Bold").fontSize(18).text(v, x + 10, y + 14, { width: tileW - 20 });
      doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(l, x + 10, y + 44, { width: tileW - 20 });
    });
    y += 90;
    doc.fillColor(INK).font("Helvetica").fontSize(10.5).text(
      `${num(data.total.pickups)} pickups in ${num(data.pickupRuns)} pickup runs, from ${num(data.giversHelped)} different givers. ` +
        `Last 12 months: ${num(data.last12Months.meals)} meals, ${num(Math.round(data.last12Months.kg))} kg, ${num(Math.round(data.last12Months.co2Kg))} kg CO2e.`,
      left, y, { width },
    );

    // Monthly bar chart (meals)
    y = doc.y + 22;
    doc.font("Helvetica-Bold").fontSize(12).text("Meals rescued per month", left, y);
    y += 22;
    const chartH = 140;
    const max = Math.max(1, ...data.monthly.map((m) => m.meals));
    const barGap = 6;
    const barW = (width - barGap * (data.monthly.length - 1)) / data.monthly.length;
    doc.moveTo(left, y + chartH).lineTo(left + width, y + chartH).lineWidth(0.5).strokeColor("#d6d3d1").stroke();
    data.monthly.forEach((m, i) => {
      const h = (m.meals / max) * (chartH - 16);
      const x = left + i * (barW + barGap);
      if (h > 0) doc.rect(x, y + chartH - h, barW, h).fill(GREEN);
      if (m.meals > 0) doc.fillColor(INK).font("Helvetica").fontSize(8).text(String(m.meals), x, y + chartH - h - 11, { width: barW, align: "center" });
      doc.fillColor(MUTED).font("Helvetica").fontSize(8).text(m.label, x, y + chartH + 4, { width: barW, align: "center" });
    });
    y += chartH + 30;

    // Categories
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(12).text("What you rescued", left, y);
    y += 20;
    if (data.categories.length === 0) doc.font("Helvetica").fontSize(10.5).fillColor(MUTED).text("No collected pickups yet.", left, y);
    const catMax = Math.max(1, ...data.categories.map((c) => c.meals));
    for (const c of data.categories.slice(0, 6)) {
      doc.fillColor(INK).font("Helvetica").fontSize(10).text(CATEGORY[c.category] ?? c.category, left, y, { width: 110 });
      doc.roundedRect(left + 115, y + 1, ((width - 175) * c.meals) / catMax, 9, 3).fill(HONEY);
      doc.fillColor(INK).text(`${num(c.meals)}`, left + width - 50, y, { width: 50, align: "right" });
      y += 17;
    }

    // Method
    y = Math.max(y + 18, doc.page.height - 150);
    doc.moveTo(left, y).lineTo(left + width, y).lineWidth(0.5).strokeColor("#d6d3d1").stroke();
    doc.fillColor(MUTED).font("Helvetica").fontSize(8.5).text(
      `How we count: only pickups marked collected count. Weight is what the giver entered, or ${factors.kgPerPortion} kg per portion when they didn't. ` +
        `CO2e avoided uses ${factors.co2ePerKg} kg CO2e per kg of food not wasted; water uses ${factors.waterLitresPerKg} litres per kg ` +
        "(blue water footprint of wasted food, FAO Food Wastage Footprint 2013). All figures are estimates.",
      left, y + 10, { width },
    );
    doc.text("freshshare.de · free food from neighbours, safely", left, doc.page.height - 60, { width, align: "center" });
    doc.end();
  });
}
