-- Export Canadian pathway_steps
SELECT ps.id, ps.pathway_id, p.slug as pathway_slug, p.title as pathway_title,
       ps.step_number, ps.title, ps.description, ps.type, ps.is_optional
FROM public.pathway_steps ps
JOIN public.pathways p ON ps.pathway_id = p.id
JOIN public.countries c ON p.country_id = c.id
WHERE c.iso_code = 'CA'
ORDER BY p.title, ps.step_number;

-- Export Canadian document_requirements
SELECT dr.id, dr.pathway_id, p.slug as pathway_slug, p.title as pathway_title,
       dr.name, dr.description, dr.document_type, dr.is_mandatory, dr.sort_order, dr.step_id
FROM public.document_requirements dr
JOIN public.pathways p ON dr.pathway_id = p.id
JOIN public.countries c ON p.country_id = c.id
WHERE c.iso_code = 'CA'
ORDER BY p.title, dr.sort_order;
