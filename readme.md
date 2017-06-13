# comparator-pipeline

> Configurable comparator for use in the array.sort() call

## Features

- Chained call of any length results in a comparator function
- Short and simple syntax
- Support for mapping values
- Extendable by adding more comparators or mappers

## Usage examples

```javascript
import Comparator from 'comparator-pipeline';

array.sort(Comparator);
array.sort(Comparator.descending);
array.sort(Comparator.map(v => something(v)).reversed);
array.sort(Comparator.key('a').natural.key('b').reversed);
```

## [Changelog](https://raw.githubusercontent.com/nicolasdejong/comparator-pipeline/master/CHANGELOG.txt)

## Install

```
$ npm install comparator-pipeline --save
```

## API

The Comparator is a function used to compare two values and return < 0, 0 or > 0.
Each Comparator call will return the comparator function (e.g. Comparator or Comparator.natural or Comparator.natural.reversed).
The Comparator contains a pipeline of steps. The pipeline is performed left to right.

Make sure to call the pipeline steps in the right order because otherwise some may be ignored.

So ```Comparator.natural.reversed``` works as expected.
But ```Comparator.reversed.natural``` will not be reversed because the actual sort is after the ```reversed``` step.

When no comparator is added to the pipeline, the default comparator (literal) will be used. (which will be called when needed so, for example, ```Comparator.reversed.natural``` will call the default comparator to get the reversed value, then call the natural comparator)

#### Possible pipeline steps:

| Comparators | |
| --- | --- |
|**literal**    | Compare using < and >. (default)
|**natural**    | Compare '8' before '20' when strings. (for a natural sort)
|**locale**     | Compare using localization. Is configurable, so calls with args as in String.localeCompare(...) without the first, or empty for defaults.

|_valueMappers_ | |
| --- | --- |
|**text**       | Map values to string (alias: string[s]).
|**number[s]**  | Map values to floats (using parseFloat).
|**map(mapper)**| Map values using a mapper function. Mapper should be in the form ```(value, initialValue) => value```. ```value``` is the value to compare (which can be different from ```initialValue``` because it may have been mapped before). ```initialValue```is the initial array element.
|**ignoreCase** | Maps values to lowercase string.
|**trim**       | Maps values to trimmed string.

|_resultMappers_| |
| --- | --- |
|**reverse[d]**  | Reverse results (ascending <-> descending). Comparators are ascending by default.
|**ascend[ing]** | Results are made ascending (a-z). (actually reverses if reversed)
|**descend[ing]**| Results are made descending (z-a). (actually reverses if not reversed)

|_other steps_  | |
| --- | --- |
|**key(name)**  | Alias of ```.orElse.map((val, obj) => obj[name])```.
|**orElse**     | Stops the pipeline if the previous comparison is non-0 (non-equal). Otherwise resets and continues as if new.
|**end**        | Stops the pipeline, even if there is no result. This may be needed when using a configurable function without braces as last step.

|_configure_    | |
| --- | --- |
|**setup(...)** | Configure from strings, like 'natural', 'reversed'.

##### Examples:

```javascript
array.sort( Comparator )
array.sort( Comparator.reversed )
array.sort( Comparator.natural.descending )
array.sort( Comparator.locale.ascending )
array.sort( Comparator.key('foo').literal.strings )
array.sort( Comparator.map( obj => obj.n * obj.a ).numbers )
array.sort( Comparator.key('foo').map( (k, obj) => k * obj.a ).numbers )
array.sort( Comparator.key('a').reversed.key('b').numbers.key('c').literal.strings )
array.sort( Comparator.map((v,o)=>o.a).ascending.orElse.map((v,o)=>o.b).descending )
array.sort( Comparator.setup('key', 'a', 'numbers', 'reversed') )
array.sort( Comparator.locale('de') )
array.sort( Comparator.locale() )
array.sort( Comparator.locale.end ) // ".end" because of no braces for configurable
```

## Example: Key

Comparing an array of objects:

```javascript
let array = [ { firstName:..., lastName:..., age:... }, ... ]

array.sort(Comparator.key('lastName').natural
                     .key('firstName')
                     .key('age').descending);
```
This will sort the array on lastName (natural ascending), except when the
lastName is equal which will sort on firstName (literal ascending), except
when the firstName is equal which will sort on age (literal descending).

The ```key(String)``` call will reset previous settings like reversed
or natural. It will stop the pipeline when a non-0 (non-equal) result was achieved.

Alternatively the 'orElse' can be used:

```
array.sort(Comparator       .map((o,v) => o.lastName).natural
                     .orElse.map((o,v) => o.firstName)
                     .orElse.map((o.v) => o.age).reversed );
```

## Extending pipeline functionality

Functionality can be added by assigning functions to Comparator:

```Comparator[.type].name = function(...)```

All steps can be added via the '**steps**' type. A step function is called with a pipeline state.
The ```this``` of the function is also pipeline state.

A few convenience types are available that don't have to use the pipeline state directly:

| Type | Parameters | Return | Description |
| --- | --- | --- |
|**comparators** | valueA, valueB | < 0, 0 or > 0 | comparator functions (default when type is omitted). **must** be ascending.
|**valueMappers** | value, initialValue | new value | Value mapper functions.
|**resultMappers**| result | new result | Result mapper functions.

- The 'comparators' type is default and can be omitted.
- When using the extension, the type (valueMappers, resultMappers, etc) should be omitted.
- All names should be unique.
- When an extention requires configuration, use 'configurable' (see below)

The Comparator-pipeline is called for each comparison needed to sort the array.
So it will be called with two array items and should return < 0, 0 or > 0.
Each pipeline-step is called until the end or until a pipeline step determines the pipeline is finished.

'**steps**' functions get a pipeline-state to update.

The pipeline-state has the following fields:

- **a** value to compare
- **b** value to compare against
- **initialA** initial value of a (a may have changed due to mapping)
- **initialB** initial value of b (b may have changed due to mapping)
- **result** the comparison result, or undefined
- **isFinished** true when no more steps in the pipeline should be executed
- **pipeline** array of steps in the pipeline.
- **step** current step. Step looks like { type, name, func }
- **comparator** last used comparator (e.g. the literal or natural function)
- **checkResult()** calls getResult() if result is undefined
- **getResult()** uses comparator (default comparator if not set) to set result.
- **hasResult()** true when result is not undefined and not 0.
- **reset()** sets state back to begin: no result, not finished, initial a/b, comparator default.

A step function can update the current state, for example by changing a/b or setting the result.

A step function can be made configurable by setting 'configurable' in the path.
The step function should return a function then:

```Comparator.steps.configurable.test = (cfg1, cfg2) => state => do something with cfg1, cfg2 and state.```


##### Examples:

```javascript
Comparator.valueMappers.abs = val => Math.abs(val);
array.sort( Comparator.numbers.abs )

Comparator.valueMappers.ignoreCase = v => String(v).toLowerCase();
array.sort(Comparator.ignoreCase)

Comparator.valueMappers.onFirstCapital = v => v.replace( /^(.*?)([A-Z][^ ]+)/, '$2$1' );
array.sort(Comparator.onFirstCapital)

Comparator.reversed = result => -result;
array.sort( Comparator.numbers.abs.reversed );

Comparator.steps.stop = state => state.isFinished = true;
```


```javascript
Comparator.valueMappers.ignoreCase = v => String(v).toLowerCase();
```

makes it possible to use ```Comparator.ignoreCase```

or:

```javascript
Comparator.valueMappers.sortOnFirstCapital = v => v.replace( /^(.*?)([A-Z][^ ]+)/, '$2$1' );
```

makes it possible to use ```Comparator.sortOnFirstCapital```


#### Extension configuration

When an extension requires configuration input, the 'configurable' key
should be used, and the function should return a function.

```javascript
Comparator.configurable.example = (...cfg) => (a, b) ==> { something with a, b, cfg };
```

For example in ```Comparator.abs.reversed```, 'abs' does not have any configuration. But in ```Comparator.key('a').reversed```, 'key' has one or more key-names as configuration.

(the explicit use ('configurable') is better than guessing if the function returns a function)

#### Overwriting functionality

It is also possible to overwrite existing handlers.
For example the default 'numbers' valueMapper is this:

```javascript
Comparator.valueMappers.numbers = v => parseFloat(v);
```

which you can change (for example) to:

```javascript
Comparator.valueMappers.numbers = v => parseInt(v);
```

or let trim also trim braces:

```javascript
Comparator.valueMappers.trim = v => v.replace( /^[{(\s]+|[})\s]+$/g, '' );
```

Existing functionality can be removed by using the ```delete``` keyword, without the type.

```javascript
delete Comparator.trim
```

## License

MIT (C) Nicolas de Jong
