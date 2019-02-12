import { DgraphClientStub, DgraphClient, Mutation, Operation } from 'dgraph-js';
import { credentials } from 'grpc';

export default async (dgraphHost = 'localhost:9080') => {
  const clientStub = new DgraphClientStub(
    dgraphHost,
    credentials.createInsecure(),
  );

  const client = new DgraphClient(clientStub);
  client.setDebugMode(true);

  const txn = client.newTxn();

  try {
    // drop all existing
    const op = new Operation();
    op.setDropAll(true);
    await client.alter(op);

    const indexOp = new Operation();
    op.setSchema(`
    name: string @index(term) .
    release_date: datetime @index(year) .
    revenue: float .
    running_time: int .
    `);
    await client.alter(op);

    const data = [
      '_:luke <name> "Luke Skywalker" .',
      '_:luke <Person> true .',
      '_:leia <name> "Princess Leia" .',
      '_:leia <Person> true .',
      '_:han <name> "Han Solo" .',
      '_:han <Person> true .',
      '_:lucas <name> "George Lucas" .',
      '_:lucas <Person> .',
      '_:irvin <name> "Irvin Kernshner" .',
      '_:irvin <Person> true .',
      '_:richard <name> "Richard Marquand" .',
      '_:richard <Person> true .',

      '_:sw1 <name> "Star Wars: Episode IV - A New Hope" .',
      '_:sw1 <Movie> true .',
      '_:sw1 <release_date> "1977-05-25" .',
      '_:sw1 <revenue> "775000000" .',
      '_:sw1 <running_time> "121" .',
      '_:sw1 <starring> _:luke .',
      '_:sw1 <starring> _:leia .',
      '_:sw1 <starring> _:han .',
      '_:sw1 <director> _:lucas .',

      '_:sw2 <name> "Star Wars: Episode V - The Empire Strikes Back" .',
      '_:sw2 <Movie> true .',
      '_:sw2 <release_date> "1980-05-21" .',
      '_:sw2 <revenue> "534000000" .',
      '_:sw2 <running_time> "124" .',
      '_:sw2 <starring> _:luke .',
      '_:sw2 <starring> _:leia .',
      '_:sw2 <starring> _:han .',
      '_:sw2 <director> _:irvin .',

      '_:sw3 <name> "Star Wars: Episode VI - Return of the Jedi" .',
      '_:sw3 <Movie> true .',
      '_:sw3 <release_date> "1983-05-25" .',
      '_:sw3 <revenue> "572000000" .',
      '_:sw3 <running_time> "131" .',
      '_:sw3 <starring> _:luke .',
      '_:sw3 <starring> _:leia .',
      '_:sw3 <starring> _:han .',
      '_:sw3 <director> _:richard .',

      '_:st1 <name> "Star Trek: The Motion Picture" .',
      '_:st1 <Movie> true .',
      '_:st1 <release_date> "1979-12-07" .',
      '_:st1 <revenue> "139000000" .',
      '_:st1 <running_time> "132" .',
    ].join('\n');

    const mu = new Mutation();
    mu.setSetNquads(data);
    console.log('done seeding data');
  } catch (err) {
    console.error(err);
    await txn.discard();
    process.exit(1);
  }
};
