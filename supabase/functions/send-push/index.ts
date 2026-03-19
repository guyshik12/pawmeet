import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

serve(async (req) => {
  try {
    const payload = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // --- Pack approval notification ---
    if (payload.type === 'pack_approval') {
      const { userId, packId } = payload;
      if (!userId || !packId) return new Response('missing userId or packId', { status: 400 });

      const { data: profile } = await supabase
        .from('profiles').select('push_token').eq('id', userId).single();
      if (!profile?.push_token) return new Response('no token', { status: 200 });

      const { data: pack } = await supabase
        .from('packs').select('name').eq('id', packId).single();

      const { data: member } = await supabase
        .from('pack_members').select('dog_id').eq('pack_id', packId).eq('user_id', userId).single();
      let dogName = 'Your dog';
      if (member?.dog_id) {
        const { data: dog } = await supabase
          .from('dogs').select('name').eq('id', member.dog_id).single();
        if (dog?.name) dogName = dog.name;
      }

      const packName = pack?.name ?? 'a pack';
      await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: profile.push_token,
          title: packName,
          body: `${dogName} was accepted into ${packName}! 🎉`,
          sound: 'default',
          channelId: 'messages',
        }),
      });
      return new Response('ok', { status: 200 });
    }

    // --- Existing DM message notification ---
    const { record } = payload;
    if (!record?.friendship_id || !record?.sender_id || !record?.content) {
      return new Response('invalid payload', { status: 400 });
    }

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
