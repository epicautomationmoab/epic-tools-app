-- Epic UUI Development only: jgpihdpcdlqugmqanzfj.
-- Existing function checks active employee and sender/recipient ownership.
GRANT EXECUTE ON FUNCTION public.epic_ping_action(text,uuid,text,uuid,uuid) TO authenticated;
