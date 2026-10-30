type OrderRow = {
    Id: string;
    CustomerName: string;
    OrderDate: number;
};

export default {
  async fetch(request, env) {
    const result = await env.CODEFORGE_DB.prepare(
        "SELECT Id, CustomerName, OrderDate FROM [Order] ORDER BY ShippedDate DESC LIMIT 100",
    ).run<OrderRow>();

    return new Response(JSON.stringify(result));
  }
}
