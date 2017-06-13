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
  it('locale', () => {
    expect( Comparator.locale('de', { sensitivity: 'base' })('ä', 'a') ).toBe(0);
    expect( Comparator.locale('sv'                         )('ä', 'a') ).toBeGreaterThan(0);
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
  it('orElse', () => {
    expect( objects.slice().sort(Comparator.map((v,o)=>o.a)
                                    .orElse.map((v,o)=>o.b)
                                    .orElse.map((v,o)=>o.c))
      .map( obj => obj.id ) )
      .toEqual( [1, 3, 2, 5, 4] );
    expect( objects.slice().sort(Comparator.map((v,o)=>o.a).reversed
                                    .orElse.map((v,o)=>o.b).reversed
                                    .orElse.map((v,o)=>o.c).reversed)
      .map( obj => obj.id ) )
      .toEqual( [4, 5, 2, 3, 1] );
    expect( objects.slice().sort(Comparator.map((v,o)=>o.a)
                                    .orElse.map((v,o)=>o.b)
                                    .orElse.map((v,o)=>o.c).reversed)
      .map( obj => obj.id ) )
      .toEqual( [1, 3, 5, 2, 4] );
    let deep = [ { a1: { a2: { a: 5 } } }, { a1: { a2: { a: 1 } } } ];
    expect( Comparator.key('a1', 'a2', 'a')(deep[0], deep[1]) ).toBe(1);
  });
  it('keys with valuemapper', () => {
    const toTime = (val, item) => 10 - item.timeBase;
    const toName = (val, item) => '@' + item.name;
    const toSort = [
      { index: 3, name: 'g', timeBase: 6 },
      { index: 1, name: 'a', timeBase: 4 },
      { index: 0, name: 'a', timeBase: 5 },
      { index: 4, name: 'g', timeBase: 3 },
      { index: 2, name: 'b', timeBase: 2 }
    ];
    let cmp;

    cmp = Comparator.key('name').map(val => '@' + val)
                    .key('timeBase').map(toTime);
    expect(toSort.slice().sort(cmp).map(e=>e.index)).toEqual([0, 1, 2, 3, 4]);

    cmp = Comparator.map(toName)
                    .orElse.map(toTime);
    expect(toSort.slice().sort(cmp).map(e=>e.index)).toEqual([0, 1, 2, 3, 4]);
  });
  it('map', () => {
    expect( objects.slice().sort(Comparator.key('c').map( (val, obj) => val * (obj.id > 4 ? -1 : 1 )))
      .map( obj => obj.id ) )
      .toEqual( [5, 3, 2, 1, 4] );
    const objects2 = objects.slice();
    objects2[1] = undefined;
    expect( objects2.sort(Comparator.key('c').map( (val, obj) => val * (obj.id > 4 ? -1 : 1 )))
      .map( obj => (obj || {}).id || 0 ) )
      .toEqual( [5, 3, 1, 4, 0] );
    const objects3 = objects.slice();
    objects3[1] = undefined;
    objects3[2] = undefined;
    expect( objects3.sort(Comparator.key('c').map( (val, obj) => val * (obj.id > 4 ? -1 : 1 )))
      .map( obj => (obj || {}).id || 0 ) )
      .toEqual( [5, 1, 4, 0, 0] );
    expect( [undefined, undefined].sort(Comparator.key('c').map( (val, obj) => val * (obj.id > 4 ? -1 : 1 ))))
      .toEqual( [undefined, undefined] );
  });
  it('setup', () => {
    let cmp = Comparator.key('a').setup('reversed', 'key', 'b', 'reversed', 'key', 'c', 'reversed' );
    expect( objects.slice().sort(cmp)
      .map( obj => obj.id ) )
      .toEqual( [4, 5, 2, 3, 1] );
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
  it('plugins.steps', () => {
    let obs = [ { a: 1, ab: 5 }, { a: 2, ab: 4 }, { a: 3, ab: 3 }];
    Comparator.steps.ab = val => function() {
      let state = this;
      state.a = state.initialA.ab;
      state.b = state.initialB.ab;
    };
    expect( obs.sort( Comparator.ab ).map( o => o.a ) ).toEqual([ 3, 2, 1]);
  });
  it('plugins.resultMappers', () => {
    Comparator.resultMappers.twice = r => r * 2;
    expect( Comparator.twice(3, 4) ).toEqual(-2);
  });
  describe('plugins.configurable', () => {
    it('no braces', () => {
      let nb_a;
      let nb_b;
      let nb_r;
      Comparator.resultMappers.configurable.noBraces = (a, b) => result => {
        nb_a = a;
        nb_b = b;
        nb_r = result;
        return 0;
      };
      expect( Comparator.noBraces.end('p', 'q') ).toBe(0);
      expect( nb_a ).toBe(undefined);
      expect( nb_b ).toBe(undefined);
      expect( nb_r ).toBe(-1);
    });
    it('braces without args', () => {
      let nb_a;
      let nb_b;
      let nb_r;
      Comparator.resultMappers.configurable.noArgs = (a, b) => result => {
        nb_a = a;
        nb_b = b;
        nb_r = result;
        return 0;
      };
      expect( Comparator.noArgs().end('p', 'q') ).toBe(0);
      expect( nb_a ).toBe(undefined);
      expect( nb_b ).toBe(undefined);
      expect( nb_r ).toBe(-1);
    });
    it('braces with args', () => {
      Comparator.resultMappers.configurable.margs = (a, b, c) => obj => {
        return obj + (a || 0) + (b || 0) + (c || 0);
      };
      expect( Comparator.margs(1, 2, 3)(11, 22) ).toBe(5);
    });
  });

  it('no state leaks', () => {
    let a = Comparator.natural;
    let b = a.reversed;

    expect( [1, 3, 2].sort(a) ).toEqual( [1, 2, 3] );
    expect( [1, 3, 2].sort(b) ).toEqual( [3, 2, 1] );
  });
  it('readonly fields should not be writable', () => {
    const f = () => {};
    expect( () => Comparator.comparators = f ).toThrow();
    expect( () => Comparator.comparators.configurable = f ).toThrow();
    expect( () => Comparator.valueMappers = f ).toThrow();
    expect( () => Comparator.valueMappers.configurable = f ).toThrow();
    expect( () => Comparator.resultMappers = f ).toThrow();
    expect( () => Comparator.resultMappers.configurable = f ).toThrow();
    expect( () => Comparator.steps = f ).toThrow();
    expect( () => Comparator.steps.configurable = f ).toThrow();
    expect( () => Comparator.configurable = f ).toThrow();
  });
  it('fields should only accept functions', () => {
    const f = () => {};
    expect( () => Comparator.comparators.test = [] ).toThrow();
    expect( () => Comparator.comparators.test = f ).not.toThrow();
    expect( () => Comparator.comparators.configurable.test = [] ).toThrow();
    expect( () => Comparator.comparators.configurable.test = f ).not.toThrow();
    expect( () => Comparator.valueMappers.test = [] ).toThrow();
    expect( () => Comparator.valueMappers.test = f ).not.toThrow();
    expect( () => Comparator.valueMappers.configurable.test = [] ).toThrow();
    expect( () => Comparator.valueMappers.configurable.test = f ).not.toThrow();
    expect( () => Comparator.resultMappers.test = [] ).toThrow();
    expect( () => Comparator.resultMappers.test = f ).not.toThrow();
    expect( () => Comparator.resultMappers.configurable.test = [] ).toThrow();
    expect( () => Comparator.resultMappers.configurable.test = f ).not.toThrow();
    expect( () => Comparator.steps.test = [] ).toThrow();
    expect( () => Comparator.steps.test = f ).not.toThrow();
    expect( () => Comparator.steps.configurable.test = [] ).toThrow();
    expect( () => Comparator.steps.configurable.test = f ).not.toThrow();
    expect( () => Comparator.configurable.test = [] ).toThrow();
    expect( () => Comparator.configurable.test = f ).not.toThrow();
  });
  it('non-existing function should throw', () => {
    expect( () => array.slice().sort(Comparator.nonexisting) ).toThrow();
  });
  it('it should be possible to delete functionality', () => {
    Comparator.toDelete = (a, b) => 0;
    expect( () => Comparator.toDelete(1, 2) ).not.toThrow();
    delete Comparator.toDelete;
    expect( () => Comparator.toDelete(1, 2) ).toThrow();

    Comparator.resultMappers.toDelete = (a, b) => 0;
    expect( () => Comparator.resultMappers.toDelete(1, 2) ).not.toThrow();
    delete Comparator.resultMappers.toDelete;
    expect( () => Comparator.resultMappers.toDelete(1, 2) ).toThrow();
  });
});
