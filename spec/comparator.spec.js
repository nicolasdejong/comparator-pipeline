'use strict'
let Comparator = require('../src/comparator');

const array = ['a', 'c', 'b', '8', '20'];
const objects = [
  { id: 1, a: 1, b: 2, c: 3 },
  { id: 2, a: 5, b: 1, c: 2 },
  { id: 3, a: 3, b: 8, c: 1 },
  { id: 4, a: 5, b: 4, c: 4 },
  { id: 5, a: 5, b: 1, c: 5 }
];

describe('Comparator', () => {

  it('minimal', () => {
    expect( array.slice().sort(Comparator) )
      .toEqual( ['20', '8', 'a', 'b', 'c'] );
    expect( array.slice().sort(Comparator.reversed) )
      .toEqual( ['c', 'b', 'a', '8', '20'] );
  });
  it('any', () => {
    expect( array.slice().sort(Comparator.any) )
      .toEqual( ['20', '8', 'a', 'b', 'c'] );
  });
  it('literal', () => {
    expect( array.slice().sort(Comparator.literal) )
      .toEqual( ['20', '8', 'a', 'b', 'c'] );
  });

  it('natural', () => {
    expect( array.slice().sort(Comparator.natural) )
      .toEqual( ['8', '20', 'a', 'b', 'c'] );
  });
  it('ignoreCase', () => {
    expect( ['c', 'A', 'd', 'B', 'f', 'E'].sort(Comparator.ignoreCase) )
      .toEqual( ['A', 'B', 'c', 'd', 'E', 'f'] );
  });
  it('trim', () => {
    expect( ['c', 'a', ' b'].sort(Comparator.trim) )
      .toEqual( ['a', ' b', 'c'] );
  });

  it('reversed', () => {
    expect( array.slice().sort(Comparator.natural.reversed) )
      .toEqual( ['c', 'b', 'a', '20', '8'] );
  });
  it('ascending', () => {
    const ascendingArray = ['8', '20', 'a', 'b', 'c'];
    expect( array.slice().sort(Comparator.ascending) )
      .toEqual( ['20', '8', 'a', 'b', 'c'] );
    expect( array.slice().sort(Comparator.natural.ascending) )
      .toEqual( ascendingArray );
    expect( array.slice().sort(Comparator.natural.reversed.ascending) )
      .toEqual( ascendingArray );
    expect( array.slice().sort(Comparator.natural.reversed.descending.ascending) )
      .toEqual( ascendingArray );
  });
  it('descending', () => {
    const descendingArray = ['c', 'b', 'a', '20', '8'];
    expect( array.slice().sort(Comparator.descending) )
      .toEqual( ['c', 'b', 'a', '8', '20'] );
    expect( array.slice().sort(Comparator.natural.descending) )
      .toEqual( descendingArray );
    expect( array.slice().sort(Comparator.natural.reversed.descending) )
      .toEqual( descendingArray );
    expect( array.slice().sort(Comparator.natural.reversed.ascending.descending) )
      .toEqual( descendingArray );
  });
  it('key', () => {
    expect( objects.slice().sort(Comparator.key('c'))
      .map( obj => obj.id ) )
      .toEqual( [3, 2, 1, 4, 5] );
  });
  it('keys', () => {
    expect( objects.slice().sort(Comparator.key('a').key('b').key('c'))
      .map( obj => obj.id ) )
      .toEqual( [1, 3, 2, 5, 4] );
    expect( objects.slice().sort(Comparator.key('a').reversed.key('b').reversed.key('c').reversed )
      .map( obj => obj.id ) )
      .toEqual( [4, 5, 2, 3, 1] );
    expect( objects.slice().sort(Comparator.key('a').key('b').key('c').reversed )
      .map( obj => obj.id ) )
      .toEqual( [1, 3, 5, 2, 4] );
    let deep = [ { a1: { a2: { a: 5 } } }, { a1: { a2: { a: 1 } } } ];
    expect( Comparator.key('a1', 'a2', 'a')(deep[0], deep[1]) ).toBe(1);
  });
  it('map', () => {
    expect( objects.slice().sort(Comparator.key('c').map( (val, obj) => val * (obj.id > 4 ? -1 : 1 )))
      .map( obj => obj.id ) )
      .toEqual( [5, 3, 2, 1, 4] );
  });
  it('setup', () => {
    expect( objects.slice().sort(Comparator.setup('key', 'a', 'reversed', 'key', 'b', 'reversed', 'key', 'c', 'reversed' ))
      .map( obj => obj.id ) )
      .toEqual( [4, 5, 2, 3, 1] );
  });
  it('no state leaks', () => {
    let a = Comparator.natural;
    let b = a.reversed;

    expect( [1, 3, 2].sort(a) ).toEqual( [1, 2, 3] );
    expect( [1, 3, 2].sort(b) ).toEqual( [3, 2, 1] );
  });
  it('readonly fields should not be writable', () => {
    expect( () => Comparator.comparators = [] ).toThrow();
    expect( () => Comparator.comparators.withArg = [] ).toThrow();
    expect( () => Comparator.keyMappers = [] ).toThrow();
    expect( () => Comparator.keyMappers.withArg = [] ).toThrow();
    expect( () => Comparator.valueMappers = [] ).toThrow();
    expect( () => Comparator.valueMappers.withArg = [] ).toThrow();
    expect( () => Comparator.resultMappers = [] ).toThrow();
    expect( () => Comparator.resultMappers.withArg = [] ).toThrow();
    expect( () => Comparator.withArg = [] ).toThrow();
  });
  it('plugins.valueMappers', () => {
    Comparator.valueMappers.abs = a => Math.abs(a);
    expect( [-2, 1, -4, 3, -8].sort( Comparator.abs ) )
      .toEqual( [1, -2, 3, -4, -8] );
    expect( () => Comparator.foo = 3 ).toThrow(new Error('Attempted to set Comparator function to non-function: 3'));

    Comparator.valueMappers.configurable.minus = amount => val => val - amount;
    expect( [-2, 1, -4, 3, -8].sort( Comparator.minus(3).abs ) ) // -5, -2, -7, 0, -11
      .toEqual( [3, 1, -2, -4, -8] );

    Comparator.valueMappers.configurable.minus = amount => val => val - amount; // allow overwrite
    expect( () => Comparator.minus = 3 ).toThrow(new Error('Attempted to set Comparator function to non-function: 3'));
  });
  it('plugins.keyMappers', () => {
    let obs = [ { a: 1, ab: 5 }, { a: 2, ab: 4 }, { a: 3, ab: 3 }];
    Comparator.keyMappers.ab = val => val.ab;
    expect( obs.sort( Comparator.ab ).map( o => o.a ) ).toEqual([ 3, 2, 1]);
  });
  it('plugins.resultMappers', () => {
    Comparator.resultMappers.twice = r => r * 2;
    expect( Comparator.twice(3, 4) ).toEqual(-2);
  });
  it('configurable multiple args', () => {
    Comparator.resultMappers.configurable.margs = (a, b, c) => obj => {
      return obj + (a || 0) + (b || 0) + (c || 0);
    };
    expect( Comparator.margs(1, 2, 3)(11, 22) ).toBe(5);
  });
});
