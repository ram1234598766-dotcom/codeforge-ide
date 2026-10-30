export default {
  async fetch(request, env, ctx) {
    // write a key-value pair
    await env.CODEFORGE_KV.put('KEY', 'VALUE');

    // read a key-value pair
    const value = await env.CODEFORGE_KV.get('KEY');

    // list all key-value pairs
    const allKeys = await env.CODEFORGE_KV.list();

    // delete a key-value pair
    await env.CODEFORGE_KV.delete('KEY');

    // return a Workers response
    return new Response(
      JSON.stringify({
        value: value,
        allKeys: allKeys,
      }),
    );
  }
}
