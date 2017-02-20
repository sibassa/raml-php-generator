import {Strands} from 'strands'
import {Api} from 'raml-generator'
import pascalCase = require('pascal-case')
import camelCase = require('camel-case')
import upperCaseFirst = require('upper-case-first')
import stringify = require('javascript-stringify')
import { hasSecurity, getSecuritySchemes, allResources, nestedResources, NestedMethod, NestedResource } from '../support/api'
import {
    supportStrictTypes as st, toNamespace
} from '../support/feature'

export default function (api:any, data: any):string {
    const s = new Strands();
    const apiTypes = api.types ? api.types : [];
    const apiType = data.type ? data.type : [];
    s.line(`<?php`);
    if (st()) {
        s.line(`declare(strict_types=1);`);
    }
    s.multiline(`
namespace ${toNamespace(api.title)}\\Model;
`);

    const displayNames = data.displayNames;
    const discriminatorList = data.discriminatorList;
    createModel(apiType);

    function getReturnType(property:any): string
    {
        const overrideType = property.annotations && property.annotations['generator-type'] ? property.annotations['generator-type'] : '';
        if (overrideType) {
            const arrayType = overrideType.structuredValue.includes('[]');
            const itemType = overrideType.structuredValue.replace('[]', '');
            const overrideProperty = {
                name: property.name,
                type: arrayType ? ['array'] : [overrideType.structuredValue],
                items: arrayType ? itemType : null
            };
            return getReturnType(overrideProperty);
        }
        const propertyType = property.type.length == 1 ? property.type[0] : '';
        switch (propertyType) {
            case 'string':
                return 'string';
            case 'boolean':
                return 'bool';
            case 'integer':
                return 'int';
            case 'number':
                return 'float';
            case 'datetime':
            case 'date-only':
            case 'time-only':
            case 'datetime-only':
                return '\\DateTimeImmutable';
            case 'array':
                if (property.items && displayNames[property.items]) {
                    return `${displayNames[property.items]}Collection`;
                } else {
                    return `array`;
                }
            case 'object':
                return `array`;
            default:
                const instanceClass = displayNames[propertyType] ? displayNames[propertyType] : '';
                if (instanceClass) {
                    return `${instanceClass}`;
                }
                return `array`;
        }
    }

    function addDiscriminatorResolver(discriminatorType: any)
    {
        const discriminatorDef = discriminatorList[discriminatorType] ? discriminatorList[discriminatorType] : false;
        if (discriminatorDef) {
            s.multiline(`
    private static $discriminatorClasses = [`);
            discriminatorDef.forEach(function (classDef: any) {
                s.line(`        ${stringify(classDef.discriminatorValue)} => ${classDef.type}::class,`)
            });
            s.multiline(`    ];
    
    public static function resolveDiscriminatorClass($value)
    {
        if (isset($value[static::DISCRIMINATOR_FIELD])) {
            $discriminatorValue = $value[static::DISCRIMINATOR_FIELD];
            if (isset(static::$discriminatorClasses[$discriminatorValue])) {
                return static::$discriminatorClasses[$discriminatorValue];
            }
        }
        return ${discriminatorType}::class;
    }`);
        }
    }

    function getMapping(property:any): string
    {
        const overrideType = property.annotations && property.annotations['generator-type'] ? property.annotations['generator-type'] : '';
        if (overrideType) {
            const arrayType = overrideType.structuredValue.includes('[]');
            const itemType = overrideType.structuredValue.replace('[]', '');
            const overrideProperty = {
                name: property.name,
                type: arrayType ? ['array'] : [overrideType.structuredValue],
                items: arrayType ? itemType : null
            };
            return getMapping(overrideProperty);
        }
        const propertyName = property.name;
        const propertyType = property.type.length >= 1 ? property.type[0] : '';
        const instanceClass = displayNames[propertyType] ? displayNames[propertyType] : '';
        const discriminatorClass = !!discriminatorList[instanceClass];
        switch (propertyType) {
            case 'string':
                return `$this->${propertyName} = (string)$value;`;
            case 'boolean':
                return `$this->${propertyName} = (bool)$value;`;
            case 'integer':
                return `$this->${propertyName} = (int)$value;`;
            case 'number':
                return `$this->${propertyName} = (float)$value;`;
            case 'datetime':
            case 'date-only':
            case 'time-only':
            case 'datetime-only':
                return `$this->${propertyName} = new \\DateTimeImmutable($value);`;
            case 'array':
                if (property.items && displayNames[property.items]) {
                    return `$this->${propertyName} = Mapper::map($value, ${displayNames[property.items]}Collection::class);`;
                } else {
                    return `$this->${propertyName} = $value;`;
                }
            case 'object':
                return `$this->${propertyName} = $value;`;
            default:

                if (instanceClass) {
                    if (discriminatorClass) {
                        return `$this->${propertyName} = Mapper::map($value, ${instanceClass}::resolveDiscriminatorClass($value));`;
                    }
                    return `$this->${propertyName} = Mapper::map($value, ${instanceClass}::class);`;
                }
                return `$this->${propertyName} = $value;`;
        }
    }

    function getEmptyMapping(property: any): string
    {
        const overrideType = property.annotations && property.annotations['generator-type'] ? property.annotations['generator-type'] : false;
        if (overrideType) {
            const arrayType = overrideType.structuredValue.includes('[]');
            const itemType = overrideType.structuredValue.replace('[]', '');
            const overrideProperty = {
                name: property.name,
                type: arrayType ? ['array'] : [overrideType.structuredValue],
                items: arrayType ? itemType : null
            };
            return getEmptyMapping(overrideProperty);
        }
        const propertyType = property.type.length >= 1 ? property.type[0] : '';
        const instanceClass = displayNames[propertyType] ? displayNames[propertyType] : '';
        switch (propertyType) {
            case 'string':
                return `return '';`;
            case 'boolean':
                return `return false;`;
            case 'integer':
                return `return 0;`;
            case 'number':
                return `return 0;`;
            case 'datetime':
            case 'date-only':
            case 'time-only':
            case 'datetime-only':
                return `return new \\DateTimeImmutable();`;
            case 'object':
                return `return [];`;
            case 'array':
                if (property.items && displayNames[property.items]) {
                    return `return Mapper::map([], ${displayNames[property.items]}Collection::class);`;
                } else {
                    return `return [];`;
                }
            default:
                if (instanceClass) {
                    return `return Mapper::map([], ${instanceClass}::class);`;
                }
                return 'return [];';
        }
    }

    function createModel(type:any) {
        if (type.annotations && type.annotations['generator-ignore']) {
            return;
        }
        let extendedType = type.type.length == 1 && displayNames[type.type[0]] ? displayNames[type.type[0]] : 'JsonObject';
        if (type.annotations && type.annotations['generator-type']) {
            extendedType = type.annotations['generator-type'].structuredValue;
        }
        s.line(`class ${type.name}${extendedType ? ` extends ${extendedType}` : ''} {`);
        if (type.type.length == 1 && type.type[0] == 'string') {
            for (const enumValue of type.enum) {
                s.line(`    const ${enumValue.toUpperCase().replace(/[-]/g, '_')} = ${stringify(enumValue)};`);
            }
        }
        if (type.properties) {
            for (const key of Object.keys(type.properties)) {
                const property = type.properties[key];
                if (property.name[0] == '/') {
                    continue;
                }
                s.line(`    protected $${property.name};`);
            }
        }
        if (type.discriminator) {
            s.multiline(`
    const DISCRIMINATOR_VALUE = null;
    const DISCRIMINATOR_FIELD = ${stringify(type.discriminator)};
    public function __construct(array $data = []) {
        $this->${type.discriminator} = static::DISCRIMINATOR_VALUE;
        parent::__construct($data);
    }`);
            addDiscriminatorResolver(type.name);
        }
        if (type.discriminatorValue) {
            s.line(`    const DISCRIMINATOR_VALUE = ${stringify(type.discriminatorValue)};`);
        }
        if (type.properties) {
            for(const key of Object.keys(type.properties)) {
                const property = type.properties[key];
                if (property.name[0] == '/') {
                    continue;
                }
                const ignoreSt = !!(property.annotations && property.annotations['generator-ignore-strict']);
                s.multiline(`
    /**
     * @return ${getReturnType(property)}
     */
    public function get${pascalCase(property.name)}()${st() && !ignoreSt ? `: ${getReturnType(property)}` : ''}
    {
        if (is_null($this->${property.name})) {
            $value = $this->raw('${property.name}');
            if (!is_null($value)) {
                ${getMapping(property)}
            } else {
                ${getEmptyMapping(property)}
            }
        }
        return $this->${property.name};
    }
                `);
            }
        }
        s.line(`}`);
    }
    return s.toString();
}