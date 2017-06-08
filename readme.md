# comparator-pipeline

> Configurable comparator for use in the array.sort() call

## Features

- Chained call of any length results in a comparator function
- Short and simple syntax
- Support for mapping values
- Extendable by adding more comparators or mappers

## Usage examples

```javascript
import {Comparator} from 'comparator-pipeline';

array.sort(Comparator);
array.sort(Comparator.descending);
array.sort(Comparator.map(v => something(v)).reversed);
array.sort(Comparator.key('a').natural.key('b').reversed);
```

## [Changelog](https://raw.githubusercontent.com/nicolasdejong/comparator-pipeline/master/CHANGELOG.txt)

## Install

```
$ npm install comparator-pipeline
```

## API

Pipeline is performed left to right.

Make sure to call the pipeline steps in the right order because otherwise some may be ignored.

So ```Comparator.natural.reversed``` works as expected.
But ```Comparator.reversed.natural``` will not be reversed because the actual sort is after the ```reversed``` step.

When no comparator is added to the pipeline, the default comparator (literal) will be added.

#### Possible pipeline steps:

| Comparators | |
| --- | --- |
|**literal**    | Compare using < and >. (default)
|**natural**    | Compare '8' before '20' when strings. (for a natural sort)
|**locale**     | Compare using localization. Is configurable, so call with args as in String.localeCompare(...) without the first, or empty for defaults.

|_keyMappers_   | |
| --- | --- |
|**key(name)**  | Name of field. Stops when already a result. Resets next step to defaults.

|_valueMappers_ | |
| --- | --- |
|**text**       | Map values to string (alias: string[s])
|**number[s]**  | Map values to floats (using parseFloat)
|**map(mapper)**| Map values using a mapper function. Mapper should be in the form ```(value, obj) => value```. Note that obj is always the object to sort.
|**ignoreCase** | Maps values to lowercase string
|**trim**       | Maps values to trimmed string

|_resultMappers_| |
| --- | --- |
|**reverse[d]**  | Reverse results (ascending <-> descending)
|**ascend[ing]** | Results are made ascending (a-z)
|**descend[ing]**| Results are made descending (z-a)

|_configure_    | |
| --- | --- |
|**setup(...)** | Configure from strings, like 'natural', 'reversed'

##### Examples:

```javascript
array.sort( Comparator )
array.sort( Comparator.reversed )
array.sort( Comparator.natural.descending )
array.sort( Comparator.locale().ascending )
array.sort( Comparator.key('foo').literal.strings )
array.sort( Comparator.map( obj => obj.n * obj.a ).numbers )
array.sort( Comparator.key('foo').map( (k, obj) => k * obj.a ).numbers )
array.sort( Comparator.key('a').reversed.key('b').numbers.key('c').literal.strings )
array.sort( Comparator.setup('key', 'a', 'numbers', 'reversed') )
```

#### Extending pipeline functionality

```Comparator.[type].name = function(...)```

| Type | Parameters | Description |
| --- | --- | --- |
|**comparators** | valueA, valueB | comparator functions (default when type is omitted). **must** be ascending.
|**keyMappers**| value | Key mapper functions
|**valueMappers** | value, initialValue | Value mapper functions. Return the new value to be compared.
|**resultMappers**| result | Result mapper functions. Returns the new result.
|  |  |

The ```this``` will be current state. Current state holds: initialA, initialB, result, finished, pipeline.
Current state can be used by mappers. For example reversed/ascending/descending uses it to remember if the order is reversed.

##### Examples:

```javascript
Comparator.valueMappers.abs = val => Math.abs(val);
array.sort( Comparator.numbers.abs )
```



## Example: Key

Comparing an array of objects:

```javascript
let array = [ { firstName:..., lastName:..., age:... }, ... ]

array.sort(Comparator.key('lastName').natural.key('firstName').key('age').reversed);
```
This will sort the array on lastName (natural ascending), except when the
lastName is equal which will sort on firstName (literal ascending), except
when the firstName is equal which will sort on age (literal descending).

The ```key(String)``` call will reset previous settings like reversed
or natural. It will stop the pipeline when a non-0 (non-equal) result was achieved.


## Extending Comparator

Add extra functionality be simply assigning them to Comparator.
For the pipeline to understand what kind of functionality is added,
a few fields exist.

Assigning should be in the form:

```javascript
Comparator.type.name = (args) => return ...
```

Type can be one of:
- **comparators** which compares two provided arguments and returns < 0, 0 or > 0.
- **keyMappers** which changes a key (object field name).
- **valueMappers** which changes a value before the comparison.
- **resultMappers** which changes the comparison result.

- Type 'comparators' is default and can be omitted.
- When using the extension, the type (keyMappers, valueMappers, etc) should be omitted.
- All names should be unique.
- When an extention requires configuration, use 'configurable' (see below)

For example:

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

For example in ```Comparator.abs.reversed```, 'abs' does not have
any configuration. But in```Comparator.key('a').reversed', 'key' *does*
have configuration.

(this explicit use is better than guessing if the function
returns a function)

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


## License

MIT (C) Nicolas de Jong
