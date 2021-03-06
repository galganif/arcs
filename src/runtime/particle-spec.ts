/**
 * @license
 * Copyright (c) 2017 Google Inc. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * Code distributed by Google as part of this project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import {assert} from '../platform/assert-web.js';

import {Modality} from './modality.js';
import {Direction} from './recipe/handle-connection.js';
import {TypeChecker} from './recipe/type-checker.js';
import {Schema} from './schema.js';
import {TypeVariableInfo} from './type-variable-info.js';
import {InterfaceType, Type, TypeLiteral} from './type.js';

// TODO: clean up the real vs. literal separation in this file

type SerializedHandleConnectionSpec = {
  direction: Direction,
  name: string,
  type: Type | TypeLiteral,
  isOptional: boolean,
  tags?: string[],
  dependentConnections: SerializedHandleConnectionSpec[]
};

function asType(t: Type | TypeLiteral) : Type {
  return (t instanceof Type) ? t : Type.fromLiteral(t);
}

function asTypeLiteral(t: Type | TypeLiteral) : TypeLiteral {
  return (t instanceof Type) ? t.toLiteral() : t;
}

export class HandleConnectionSpec {
  rawData: SerializedHandleConnectionSpec;
  direction: Direction;
  name: string;
  type: Type;
  isOptional: boolean;
  tags: string[];
  dependentConnections: HandleConnectionSpec[];
  pattern: string;
  parentConnection: HandleConnectionSpec | null = null;

  constructor(rawData: SerializedHandleConnectionSpec, typeVarMap: Map<string, Type>) {
    this.rawData = rawData;
    this.direction = rawData.direction;
    this.name = rawData.name;
    this.type = asType(rawData.type).mergeTypeVariablesByName(typeVarMap);
    this.isOptional = rawData.isOptional;
    this.tags = rawData.tags || [];
    this.dependentConnections = [];
  }

  instantiateDependentConnections(particle, typeVarMap: Map<string, Type>) {
    for (const dependentArg of this.rawData.dependentConnections) {
      const dependentConnection = particle.createConnection(dependentArg, typeVarMap);
      dependentConnection.parentConnection = this;
      this.dependentConnections.push(dependentConnection);
    }

  }

  get isInput() {
    // TODO: we probably don't really want host to be here.
    return this.direction === 'in' || this.direction === 'inout' || this.direction === 'host';
  }

  get isOutput() {
    return this.direction === 'out' || this.direction === 'inout';
  }

  isCompatibleType(type: Type) {
    return TypeChecker.compareTypes({type}, {type: this.type, direction: this.direction});
  }
}

type SerializedConsumeSlotConnectionSpec = {
  name: string,
  isRequired: boolean,
  isSet: boolean,
  tags: string[],
  formFactor: string,
  provideSlotConnections: SerializedProvideSlotConnectionSpec[]
};

export class ConsumeSlotConnectionSpec {
  name: string;
  isRequired: boolean;
  isSet: boolean;
  tags: string[];
  formFactor: string;
  provideSlotConnections: ProvideSlotConnectionSpec[];

  constructor(slotModel: SerializedConsumeSlotConnectionSpec) {
    this.name = slotModel.name;
    this.isRequired = slotModel.isRequired;
    this.isSet = slotModel.isSet;
    this.tags = slotModel.tags || [];
    this.formFactor = slotModel.formFactor; // TODO: deprecate form factors?
    this.provideSlotConnections = [];
    if (!slotModel.provideSlotConnections) {
      return;
    }
    slotModel.provideSlotConnections.forEach(ps => {
      this.provideSlotConnections.push(new ProvideSlotConnectionSpec(ps));
    });
  }

  getProvidedSlotSpec(name): ProvideSlotConnectionSpec {
    return this.provideSlotConnections.find(ps => ps.name === name);
  }
}

type SerializedProvideSlotConnectionSpec = {
  name: string,
  isRequired?: boolean,
  isSet?: boolean,
  tags?: string[],
  formFactor?: string,
  handles?: string[]
};

export class ProvideSlotConnectionSpec {
  name: string;
  isRequired: boolean;
  isSet: boolean;
  tags: string[];
  formFactor: string;
  handles: string[];

  constructor(slotModel: SerializedProvideSlotConnectionSpec) {
    this.name = slotModel.name;
    this.isRequired = slotModel.isRequired || false;
    this.isSet = slotModel.isSet || false;
    this.tags = slotModel.tags || [];
    this.formFactor = slotModel.formFactor; // TODO: deprecate form factors?
    this.handles = slotModel.handles || [];
  }
}

type SerializedParticleSpec = {
  name: string,
  id?: string,
  verbs: string[],
  args: SerializedHandleConnectionSpec[],
  description: {pattern?: string},
  implFile: string,
  modality: string[],
  slotConnections: SerializedConsumeSlotConnectionSpec[]
};

export class ParticleSpec {
  private readonly model: SerializedParticleSpec;
  name: string;
  verbs: string[];
  handleConnections: HandleConnectionSpec[];
  handleConnectionMap: Map<string, HandleConnectionSpec>;
  inputs: HandleConnectionSpec[];
  outputs: HandleConnectionSpec[];
  pattern: string;
  implFile: string;
  modality: Modality;
  slotConnections: Map<string, ConsumeSlotConnectionSpec>;

  constructor(model : SerializedParticleSpec) {
    this.model = model;
    this.name = model.name;
    this.verbs = model.verbs;
    const typeVarMap = new Map();
    this.handleConnections = [];
    model.args.forEach(arg => this.createConnection(arg, typeVarMap));
    this.handleConnectionMap = new Map();
    this.handleConnections.forEach(a => this.handleConnectionMap.set(a.name, a));
    this.inputs = this.handleConnections.filter(a => a.isInput);
    this.outputs = this.handleConnections.filter(a => a.isOutput);

    // initialize descriptions patterns.
    model.description = model.description || {};
    this.validateDescription(model.description);
    this.pattern = model.description['pattern'];
    this.handleConnections.forEach(connectionSpec => {
      connectionSpec.pattern = model.description[connectionSpec.name];
    });

    this.implFile = model.implFile;
    this.modality = Modality.create(model.modality || []);
    this.slotConnections = new Map();
    if (model.slotConnections) {
      model.slotConnections.forEach(s => this.slotConnections.set(s.name, new ConsumeSlotConnectionSpec(s)));
    }
    // Verify provided slots use valid handle connection names.
    this.slotConnections.forEach(slot => {
      slot.provideSlotConnections.forEach(ps => {
        ps.handles.forEach(v => assert(this.handleConnectionMap.has(v), 'Cannot provide slot for nonexistent handle constraint ', v));
      });
    });
  }

  createConnection(arg: SerializedHandleConnectionSpec, typeVarMap: Map<string, Type>) {
    const connection = new HandleConnectionSpec(arg, typeVarMap);
    this.handleConnections.push(connection);
    connection.instantiateDependentConnections(this, typeVarMap);
    return connection;
  }

  isInput(param: string) {
    for (const input of this.inputs) if (input.name === param) return true;
    return false;
  }

  isOutput(param: string) {
    for (const outputs of this.outputs) if (outputs.name === param) return true;
    return false;
  }

  getConnectionByName(name: string): HandleConnectionSpec {
    return this.handleConnectionMap.get(name);
  }

  getSlotSpec(slotName: string) {
    return this.slotConnections.get(slotName);
  }

  get primaryVerb() {
    return (this.verbs.length > 0) ? this.verbs[0] : undefined;
  }

  isCompatible(modality: Modality): boolean {
    return this.slotConnections.size === 0 || this.modality.intersection(modality).isResolved();
  }

  toLiteral() : SerializedParticleSpec {
    const {args, name, verbs, description, implFile, modality, slotConnections} = this.model;
    const connectionToLiteral : (input: SerializedHandleConnectionSpec) => SerializedHandleConnectionSpec =
      ({type, direction, name, isOptional, dependentConnections}) => ({type: asTypeLiteral(type), direction, name, isOptional, dependentConnections: dependentConnections.map(connectionToLiteral)});
    const argsLiteral = args.map(a => connectionToLiteral(a));
    return {args: argsLiteral, name, verbs, description, implFile, modality, slotConnections};
  }

  static fromLiteral(literal: SerializedParticleSpec) {
    let {args, name, verbs, description, implFile, modality, slotConnections} = literal;
    const connectionFromLiteral = ({type, direction, name, isOptional, dependentConnections}) =>
      ({type: asType(type), direction, name, isOptional, dependentConnections: dependentConnections ? dependentConnections.map(connectionFromLiteral) : []});
    args = args.map(connectionFromLiteral);
    return new ParticleSpec({args, name, verbs: verbs || [], description, implFile, modality, slotConnections});
  }

  // Note: this method shouldn't be called directly.
  clone(): ParticleSpec {
    return ParticleSpec.fromLiteral(this.toLiteral());
  }

  // Note: this method shouldn't be called directly (only as part of particle copying).
  cloneWithResolutions(variableMap: Map<TypeVariableInfo|Schema, TypeVariableInfo|Schema>): ParticleSpec {
    const spec = this.clone();
    this.handleConnectionMap.forEach((conn, name) => {
      spec.handleConnectionMap.get(name).type = conn.type._cloneWithResolutions(variableMap);
    });
    return spec;
  }

  equals(other) {
    return JSON.stringify(this.toLiteral()) === JSON.stringify(other.toLiteral());
  }

  validateDescription(description) {
    Object.keys(description || []).forEach(d => {
      assert(['kind', 'location', 'pattern'].includes(d) || this.handleConnectionMap.has(d), `Unexpected description for ${d}`);
    });
  }

  toInterface() {
    // TODO: wat do?
    assert(!this.slotConnections.size, 'please implement slots toInterface');
    const handles = this.model.args.map(({type, name, direction}) => ({type: asType(type), name, direction}));
    const slots = [];
    return InterfaceType.make(this.name, handles, slots);
  }

  toString() {
    const results = [];
    let verbs = '';
    if (this.verbs.length > 0) {
      verbs = ' ' + this.verbs.map(verb => `&${verb}`).join(' ');
    }
    results.push(`particle ${this.name}${verbs} in '${this.implFile}'`.trim());
    const indent = '  ';
    const writeConnection = (connection, indent) => {
      const tags = connection.tags.map((tag) => ` #${tag}`).join('');
      results.push(`${indent}${connection.direction}${connection.isOptional ? '?' : ''} ${connection.type.toString()} ${connection.name}${tags}`);
      for (const dependent of connection.dependentConnections) {
        writeConnection(dependent, indent + '  ');
      }
    };

    for (const connection of this.handleConnections) {
      if (connection.parentConnection) {
        continue;
      }
      writeConnection(connection, indent);
    }

    this.modality.names.forEach(a => results.push(`  modality ${a}`));
    this.slotConnections.forEach(s => {
      // Consume slot.
      const consume = [];
      if (s.isRequired) {
        consume.push('must');
      }
      consume.push('consume');
      if (s.isSet) {
        consume.push('set of');
      }
      consume.push(s.name);
      if (s.tags.length > 0) {
        consume.push(s.tags.map(a => `#${a}`).join(' '));
      }
      results.push(`  ${consume.join(' ')}`);
      if (s.formFactor) {
        results.push(`    formFactor ${s.formFactor}`);
      }
      // Provided slots.
      s.provideSlotConnections.forEach(ps => {
        const provide = [];
        if (ps.isRequired) {
          provide.push('must');
        }
        provide.push('provide');
        if (ps.isSet) {
          provide.push('set of');
        }
        provide.push(ps.name);
        if (ps.tags.length > 0) {
          provide.push(ps.tags.map(a => `#${a}`).join(' '));
        }
        results.push(`    ${provide.join(' ')}`);
        if (ps.formFactor) {
          results.push(`      formFactor ${ps.formFactor}`);
        }
        ps.handles.forEach(handle => results.push(`      handle ${handle}`));
      });
    });
    // Description
    if (this.pattern) {
      results.push(`  description \`${this.pattern}\``);
      this.handleConnections.forEach(cs => {
        if (cs.pattern) {
          results.push(`    ${cs.name} \`${cs.pattern}\``);
        }
      });
    }
    return results.join('\n');
  }

  toManifestString() {
    return this.toString();
  }
}
