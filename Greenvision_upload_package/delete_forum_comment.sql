drop function if exists public.delete_forum_comment(uuid, text, text);

create or replace function public.delete_forum_comment(
  comment_id uuid,
  request_owner_token text default '',
  request_admin_token text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_comment public.forum_comments%rowtype;
  admin_token constant text := 'greenvision-admin-2024';
begin
  select *
  into target_comment
  from public.forum_comments c
  where c.id = delete_forum_comment.comment_id;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'comment_not_found');
  end if;

  if coalesce(request_admin_token, '') <> admin_token
     and coalesce(request_owner_token, '') <> coalesce(target_comment.owner_token, '') then
    raise exception 'not allowed to delete this comment';
  end if;

  delete from public.forum_comments c
  where c.id = delete_forum_comment.comment_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.delete_forum_comment(uuid, text, text) to anon;
