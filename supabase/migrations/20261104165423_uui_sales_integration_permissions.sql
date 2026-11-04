-- Isolated UUI development integration repair. Do not apply to production automatically.
CREATE TABLE IF NOT EXISTS public.sales_activity_baselines (
 activity_kind text PRIMARY KEY,
 established_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sales_activity_baselines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sales_activity_baselines FROM anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.sales_activity_baselines TO service_role;
INSERT INTO public.sales_activity_baselines(activity_kind) VALUES('repeat_shopping') ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION public.get_epic_sales_open_leads()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_profile public.team_profiles%rowtype;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_profile from public.team_profiles where user_id = auth.uid() and active = true limit 1;
  if v_profile.id is null or v_profile.role='workstation' then raise exception 'Active Epic employee profile required'; end if;

  select jsonb_build_object(
    'profile', jsonb_build_object('id',v_profile.id,'display_name',v_profile.display_name,'email',v_profile.email,'role',v_profile.role,'tripworks_user_id',v_profile.tripworks_user_id),
    'leads', coalesce((
      select jsonb_agg(
        to_jsonb(l) || jsonb_build_object(
          'drafts', coalesce((select jsonb_agg(to_jsonb(d) order by d.value_cents desc nulls last,d.last_seen_at desc nulls last) from public.sales_opportunity_drafts od join public.sales_drafts d on d.id=od.draft_id where od.opportunity_id=l.id),'[]'::jsonb),
          'notes', coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc) from public.sales_opportunity_notes n where n.opportunity_id=l.id),'[]'::jsonb),
          'assignments', coalesce((select jsonb_agg(to_jsonb(a) order by a.assigned_at desc) from public.sales_opportunity_assignment_history a where a.opportunity_id=l.id),'[]'::jsonb),
          'calls', coalesce((select jsonb_agg(jsonb_build_object(
              'id',c.callrail_call_id,'direction',c.direction,'call_type',c.call_type,'answered',c.answered,'voicemail',c.voicemail,
              'occurred_at',coalesce(c.start_time,c.first_received_at),'duration_seconds',c.duration_seconds,
              'recording_player_url',c.recording_player_url,'recording_url',c.recording_url,'call_summary',c.call_summary,'transcription_text',c.transcription_text,
              'tracking_phone_number',c.tracking_phone_number,'lead_score',c.lead_score,'lead_explanation',c.lead_explanation,
              'sentiment',c.sentiment,'call_highlights',c.call_highlights,'speaker_percent',c.speaker_percent,'keywords',c.keywords,
              'source_name',c.source_name,'campaign',c.campaign,'medium',c.medium,'device_type',c.device_type,
              'customer_city',c.customer_city,'customer_state',c.customer_state,'landing_page_url',c.landing_page_url,
              'referring_url',c.referring_url,'timeline_url',c.timeline_url,'person_resource_id',c.person_resource_id,
              'lead_status',c.lead_status,'first_touch',c.first_touch,'last_touch',c.last_touch
            ) order by coalesce(c.start_time,c.first_received_at) desc)
            from public.callrail_calls c where c.matched_opportunity_id=l.id),'[]'::jsonb),
          'texts', coalesce((select jsonb_agg(jsonb_build_object(
              'id',t.message_id,'direction',t.direction,'message_body',t.message_body,'status',t.status,'agent_name',t.agent_name,
              'occurred_at',coalesce(t.sent_at,t.first_received_at),'source_number',t.source_number,'destination_number',t.destination_number
            ) order by coalesce(t.sent_at,t.first_received_at) desc)
            from public.callrail_text_messages t where t.matched_opportunity_id=l.id),'[]'::jsonb),
          'emails', coalesce((select jsonb_agg(jsonb_build_object(
              'id',g.gmail_message_id,'direction',g.direction,'subject',g.subject,'body_text',g.body_text,
              'from_email',g.from_email,'to_emails',g.to_emails,'occurred_at',coalesce(g.received_at,g.sent_at),
              'thread_id',g.gmail_thread_id,'match_confidence',g.match_confidence
            ) order by coalesce(g.received_at,g.sent_at) desc)
            from public.gmail_messages g where g.matched_sales_opportunity_id=l.id),'[]'::jsonb),
          'quotes', coalesce((select jsonb_agg(jsonb_build_object(
              'id',q.id,'status',q.status,'experience_name',q.experience_name,'total_cents',q.total_cents,'created_by_name',q.created_by_name,
              'created_at',q.created_at,'updated_at',q.updated_at,'emailed_at',q.emailed_at,'visit_start_date',q.visit_start_date,'visit_end_date',q.visit_end_date
            ) order by q.created_at desc)
            from public.sales_quotes q where q.opportunity_id=l.id),'[]'::jsonb)
        )
        order by l.activity_window_start asc nulls last,l.lead_value_cents desc nulls last
      )
      from public.sales_open_leads_enriched l
      where coalesce(l.activity_window_end,l.activity_window_start) is null
         or coalesce(l.activity_window_end,l.activity_window_start) >= (timezone('America/Denver', now()))::date
    ),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$function$
;
REVOKE ALL ON FUNCTION public.get_epic_sales_open_leads() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_epic_sales_open_leads() TO authenticated;

