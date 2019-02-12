import { request } from 'graphql-request';

const runQuery = (query: string): any =>
  request('http://localhost:4000', query);

describe('dgraphql integration tests', () => {
  test('very basic query', async () => {
    const query = `
    query {
      movies{
        id
        title
      }
    }
    `;

    const { movies } = await runQuery(query);
    [
      'Star Wars: Episode IV - A New Hope',
      'Star Wars: Episode V - The Empire Strikes Back',
      'Star Wars: Episode VI - Return of the Jedi',
      'Star Trek: The Motion Picture',
    ].forEach(title => {
      expect(movies.find(m => m.title === title)).toBeTruthy();
    });
  }, 30000);
});
