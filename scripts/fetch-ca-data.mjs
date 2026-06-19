import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function toCSV(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  return [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(','))
  ].join('\n');
}

async function main() {
  const outDir = path.join(process.cwd(), 'docs', 'backfill');
  fs.mkdirSync(outDir, { recursive: true });

  // --- steps ---
  const { data: steps, error: stepsErr } = await supabase
    .from('pathway_steps')
    .select(`
      id,
      pathway_id,
      step_number,
      title,
      description,
      type,
      is_optional,
      pathways!inner (
        slug,
        title,
        countries!inner ( iso_code )
      )
    `)
    .eq('pathways.countries.iso_code', 'CA')
    .order('pathway_id')
    .order('step_number');

  if (stepsErr) { console.error('steps error:', stepsErr); process.exit(1); }

  const stepsFlat = steps.map(s => ({
    id: s.id,
    pathway_id: s.pathway_id,
    pathway_slug: s.pathways?.slug ?? '',
    pathway_title: s.pathways?.title ?? '',
    step_number: s.step_number,
    title: s.title,
    description: s.description,
    type: s.type,
    is_optional: s.is_optional,
  }));

  stepsFlat.sort((a, b) =>
    a.pathway_title.localeCompare(b.pathway_title) || a.step_number - b.step_number
  );

  fs.writeFileSync(path.join(outDir, 'ca-steps.csv'), toCSV(stepsFlat));
  console.log(`steps: ${stepsFlat.length} rows`);

  // --- docs ---
  const { data: docs, error: docsErr } = await supabase
    .from('document_requirements')
    .select(`
      id,
      pathway_id,
      name,
      description,
      document_type,
      is_mandatory,
      sort_order,
      step_id,
      pathways!inner (
        slug,
        title,
        countries!inner ( iso_code )
      )
    `)
    .eq('pathways.countries.iso_code', 'CA')
    .order('pathway_id')
    .order('sort_order');

  if (docsErr) { console.error('docs error:', docsErr); process.exit(1); }

  const docsFlat = docs.map(d => ({
    id: d.id,
    pathway_id: d.pathway_id,
    pathway_slug: d.pathways?.slug ?? '',
    pathway_title: d.pathways?.title ?? '',
    name: d.name,
    description: d.description,
    document_type: d.document_type,
    is_mandatory: d.is_mandatory,
    sort_order: d.sort_order,
    step_id: d.step_id,
  }));

  docsFlat.sort((a, b) =>
    a.pathway_title.localeCompare(b.pathway_title) || (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );

  fs.writeFileSync(path.join(outDir, 'ca-docs.csv'), toCSV(docsFlat));
  console.log(`docs: ${docsFlat.length} rows`);

  // --- per-pathway breakdown ---
  const stepsByPathway = {};
  for (const s of stepsFlat) {
    if (!stepsByPathway[s.pathway_slug]) stepsByPathway[s.pathway_slug] = { title: s.pathway_title, steps: 0 };
    stepsByPathway[s.pathway_slug].steps++;
  }
  console.log('\nPathway step counts:');
  for (const [slug, info] of Object.entries(stepsByPathway).sort()) {
    console.log(`  ${info.steps.toString().padStart(2)} steps  ${slug}  (${info.title})`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
