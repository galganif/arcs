/**
 * @license
 * Copyright (c) 2018 Google Inc. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * Code distributed by Google as part of this project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import {assert} from '../../platform/chai-web.js';
import {HeadlessSlotDomConsumer} from '../headless-slot-dom-consumer.js';
import {MockSlotComposer} from '../testing/mock-slot-composer.js';
import {StubLoader} from '../testing/stub-loader.js';
import {TestHelper} from '../testing/test-helper.js';

describe('Particle Execution Context', () => {
  it('substitutes slot names for model references', async () => {
    const {arc, slotComposer} = await TestHelper.create({
      manifestString: `
        particle A in 'A.js'
          consume root
            provide detail
            provide annotation

        recipe
          slot 'rootslotid-root' as slot0
          A
            consume root as slot0`,
      loader: new StubLoader({
        'A.js': `defineParticle(({DomParticle}) => {
          return class extends DomParticle {
            get template() { return '<div><div slotid$="{{$detail}}"></div><div slotid="annotation"></div></div>'; }
          };
        });`
      }),
      slotComposer: new MockSlotComposer({strict:false}).newExpectations('debug'),
    });

    const [recipe] = arc.context.recipes;
    recipe.normalize();
    await arc.instantiate(recipe);

    const slotConsumer = slotComposer.consumers[0] as HeadlessSlotDomConsumer;
    const detailContext = slotConsumer.directlyProvidedSlotContexts.find(ctx => ctx.name === 'detail');
    const annotationContext = slotConsumer.directlyProvidedSlotContexts.find(ctx => ctx.name === 'annotation');

    await slotConsumer.contentAvailable;
    assert.deepEqual(
        `<div><div slotid$="{{$detail}}"></div><div slotname="annotation" slotid$="{{$annotation}}"></div></div>`,
        slotConsumer._content.template);
    assert.deepEqual({
      '$annotation': annotationContext.id,
      '$detail': detailContext.id
    }, slotConsumer._content.model);
  });
});
