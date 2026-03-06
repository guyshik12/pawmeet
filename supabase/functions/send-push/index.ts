import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

serve(async (req) => {
  try {
    const { record } = await req.json(); // Supabase DB webhook payload
    if (!record?.friendship_id || !record?.sender_id || !record?.content) {
      return new Response('invalid payload', { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Get the friendship to find the recipient user
    const { data: friendship } = await supabase
      .from('friendships')
      .select('user_a, user_b, dog_a, dog_b')
      .eq('id', record.friendship_id)
      .single();

    if (!friendship) return new Response('friendship not found', { status: 404 });

    const recipientUserId =
      friendship.user_a === record.sender_id ? friendship.user_b : friendship.user_a;

    // Get sender dog name
    const senderDogId =
      friendship.user_a === record.sender_id ? friendship.dog_a : friendship.dog_b;
    const { data: senderDog } = await supabase
      .from('dogs')
      .select('name')
      .eq('id', senderDogId)
      .single();

    // Get recipient push token
    const { data: profile } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', recipientUserId)
      .single();

    if (!profile?.push_token) return new Response('no token', { status: 200 });

    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: profile.push_token,
        title: senderDog?.name ?? 'New message',
        body: record.content,
        sound: 'default',
        channelId: 'messages',
      }),
    });

    return new Response('ok', { status: 200 });
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
});
