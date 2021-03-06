/*
Copyright (c) 2018 Google Inc. All rights reserved.
This code may only be used under the BSD style license found at
http://polymer.github.io/LICENSE.txt
Code distributed by Google as part of this project is also
subject to an additional IP rights grant found at
http://polymer.github.io/PATENTS.txt
*/

import '../../deps/@polymer/polymer/polymer-legacy.js';
import '../arcs-shared.js';
import {summaryStatsForTemplate, strategySummary} from './se-shared.js';
import {Polymer} from '../../deps/@polymer/polymer/lib/legacy/polymer-fn.js';
import {html} from '../../deps/@polymer/polymer/lib/utils/html-tag.js';

Polymer({
  _template: html`
    <style include="shared-styles se-shared-styles">
      :host {
        display: block;
        background: white;
        border: 1px solid var(--mid-gray);
        overflow: hidden;
      }
      .section {
        border-bottom: 1px solid var(--mid-gray);
        padding: 5px;
      }
      .section > :first-child {
        text-align: center;
        font-size: 75%;
        padding-bottom: 5px;
      }
      .generated {
        color: gray;
      }
      .duplicate {
        color: blue;
      }
      .sameParentDuplicate {
        color: purple;
      }
      .invalid {
        color: red;
      }
      .null {
        color: olive;
      }
      .surviving {
        font-weight: bold;
      }
      .resolved {
        font-weight: bold;
        color: green;
      }
    </style>
    <div class="section">
      <div>Totals Summary</div>
      <template is="dom-repeat" items="{{summaryStatsForTemplate(results)}}">
        <div class="generated">Generated: Σ{{item.generatedDerivations}}</div>
        <template is="dom-if" if="{{item.duplicateDerivations}}">
          <div class="duplicate">Duplicate: ={{item.duplicateDerivations}}</div>
        </template>
        <template is="dom-if" if="{{item.duplicateSameParentDerivations}}">
          <div class="sameParentDuplicate">Same Parent Duplicate: ≡{{item.duplicateSameParentDerivations}}</div>
        </template>
        <template is="dom-if" if="{{item.nullDerivations}}">
          <div class="null">Null: ∅{{item.nullDerivations}}</div>
        </template>
        <template is="dom-if" if="{{item.invalidDerivations}}">
          <div class="invalid">Invalid: ✘{{item.invalidDerivations}}</div>
        </template>
        <div class="surviving">Surviving: ⊕{{item.survivingDerivations}}</div>
        <div class="resolved">Resolved: ✓{{item.resolvedDerivations}}</div>
      </template>
    </div>
    <template is="dom-repeat" items="{{strategySummary(results)}}">
      <div class="section">
        <div>[[item.header]]</div>
        <template is="dom-repeat" items="{{item.strategies}}">
          <div>
            [[item.strategy]]:
            <span class="generated">Σ[[item.generatedDerivations]]</span>
            <template is="dom-if" if="{{item.duplicateDerivations}}">
              <span class="duplicate">={{item.duplicateDerivations}}</span>
            </template>
            <template is="dom-if" if="{{item.duplicateSameParentDerivations}}">
              <span class="sameParentDuplicate">≡{{item.duplicateSameParentDerivations}}</span>
            </template>
            <template is="dom-if" if="{{item.nullDerivations}}">
              <span class="null">∅{{item.nullDerivations}}</span>
            </template>
            <template is="dom-if" if="{{item.invalidDerivations}}">
              <span class="invalid">✘[[item.invalidDerivations]]</span>
            </template>
            <template is="dom-if" if="{{item.survivingDerivations}}">
              <span class="surviving">⊕{{item.survivingDerivations}}</span>
            </template>
            <template is="dom-if" if="{{item.resolvedDerivations}}">
              <span class="resolved">✓{{item.resolvedDerivations}}</span>
            </template>
          </div>
        </template>
      </div>
    </template>
`,

  is: 'se-stats',
  summaryStatsForTemplate,
  strategySummary
});
