/*
 * Copyright 2020 Google LLC.
 *
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 *
 * Code distributed by Google as part of this project is also subject to an additional IP rights
 * grant found at
 * http://polymer.github.io/PATENTS.txt
 */

package arcs.core.entity

import arcs.core.common.Referencable
import arcs.core.data.Capability.Ttl
import arcs.core.data.RawEntity
import arcs.core.data.Schema
import arcs.core.storage.Dereferencer
import arcs.core.storage.StorageEndpointManager
import arcs.core.util.TaggedLog
import arcs.core.storage.Reference as StorageReference
import arcs.core.util.Time
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlin.reflect.KClass

/** A reference to an [Entity]. */
open class Reference<T : Entity>(
    val entitySpec: EntitySpec<T>,
    protected val storageReference: StorageReference
) : Storable {
    /** The schema hash for the [Reference]'s associated schema. */
    val schemaHash = entitySpec.SCHEMA.hash

    /** The entity ID for the referenced entity. */
    val entityId = storageReference.id
    val hard get() = storageReference.hard

    val creationTimestamp
        get() = storageReference.creationTimestamp
    val expirationTimestamp
        get() = storageReference.expirationTimestamp

    /** Returns the [Entity] pointed to by this reference. */
    open suspend fun dereference() = storageReference.dereference()?.let { entitySpec.deserialize(it) }

    /** Returns a [Referencable] for this reference. */
    /* internal */ fun toReferencable(): StorageReference = storageReference

    fun ensureTimestampsAreSet(time: Time, ttl: Ttl) =
        storageReference.ensureTimestampsAreSet(time, ttl)

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is Reference<*>) return false
        if (entitySpec != other.entitySpec) return false
        if (storageReference != other.storageReference) return false
        return true
    }

    override fun hashCode(): Int {
        var result = entitySpec.hashCode()
        result = 31 * result + storageReference.hashCode()
        return result
    }
}


//typealias Creator<T: Entity> = (String) -> ForeignReference<T>
// Important: the creator does the isAlive check.

object ForeignReferenceFactory {
    val mmap = mutableMapOf<Schema, (String) -> ForeignReference<out Entity, out ForeignIdentifier>>()
    val kmap = mutableMapOf<KClass<out Entity>, (String) -> ForeignReference<out Entity, out ForeignIdentifier>>()

    fun <T: Entity, I : ForeignIdentifier> registerExternalEntityType(schema: Schema, creator: (String) -> ForeignReference<T, I>) {
        mmap[schema] = creator
    }
    // fun <T: Entity> registerExternalEntityTypeNotwork(kclass: KClass<T>, creator: (String) -> ForeignReference<T>) {
    //     kmap[kclass] = creator
    // }

    // use this in the database as well? maybe move is alive to the factory, then don't need the Foreign reference to extend Reference?
    fun getFor(schema: Schema, value: String) = mmap[schema]!!(value)

    // fun <T: Entity> getForNotwork(kclass: KClass<T>, value: String): ForeignReference<T> {
    //     println("map is $kmap")
    //     println("kclass is $kclass")
    //     val v: ForeignReference<*> = kmap[kclass]!!(value)
    //     // check(v is ForeignReference<T>) //cannot check for instance of erased type. reified does not work
    //     return (v as? ForeignReference<T>)!!
    // }
}



// move this to chronicle
interface ForeignIdentifier {
    fun toSerial(): String
}

/** A reference to ... */
abstract class ForeignReference<T : Entity, I : ForeignIdentifier>(
    val identifier: I,
    entitySpec: EntitySpec<T>
) : Reference<T>(entitySpec, StorageReference(id = identifier.toSerial(), version = null)) { // would be better to not extend reference, instead create a common interface. forse crdtEntityReference

    //init { check(isAlive()) } //does this work? this is check #1 in the handle. the warning is worrying.

    /** Returns the [Entity] pointed to by this reference. */
    override suspend fun dereference(): T? = throw UnsupportedOperationException()

    abstract fun isAlive(): Boolean
    abstract fun shouldCheckonRead(): Boolean

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is ForeignReference<*, *>) return false
        if (entitySpec != other.entitySpec) return false
        if (storageReference != other.storageReference) return false
        return true
    }
}

interface EntityHandle<T: Entity> {
    fun fetch(): T
}

class ExternalEntityHandle<T: Entity>(val storageKey: ForeignStorageKey, val id: String): EntityHandle<T> {
    override fun fetch(): T {
        val v = ForeignEntityFactory.getFor(storageKey.schema, id)
        // check(v is T) Cannot check for instance of erased type: T
        return v as T //??
    }

    //inline fun <reified T : Entity> mcheck(e: Entity) = check(e is T)
}

//
//inline fun <reified T : Entity> EntitySpec<T>.getType() = T::class

class EntityHandleFactory<T: Entity>(val spec: EntitySpec<T>) {
    fun getHandle(id: String): EntityHandle<T>  {
        // if spec.isForeign() //??
        return ExternalEntityHandle(ForeignStorageKey(spec.SCHEMA), id)
    }
}


// interface EntityHandle<T: Entity> {
//     fun fetch(): T
// }
//
// class ExternalEntityHandle<T: Entity>(val storageKey: ForeignStorageKey, val id: String): EntityHandle<T> {
//     override fun fetch(): T = ForeignEntityFactory.check(storageKey.schema, id) as T
// }
//
// class EntityHandleFactory<T: Entity>(val spec: EntitySpec<T>) {
//     fun getHandle(id: String): EntityHandle<T>  {
//         return ExternalEntityHandle(ForeignStorageKey(spec.SCHEMA), id)
//     }
// }



class ForeignEntityDereferencer<T: Entity>(val spec: EntitySpec<T>) : Dereferencer<RawEntity> {
    override suspend fun dereference(reference: arcs.core.storage.Reference): RawEntity? {
        println("====deferencing")
        val entityId = reference.id
        return ForeignEntityFactory.getFor(spec.SCHEMA, entityId).serialize()
    }
}


// fun <T : Entity> referenceToExt(e: T, spec: EntitySpec<T>) =
//     Reference<T>(spec, StorageReference(e.entityId!!, storageKey=ForeignStorageKey(spec.SCHEMA), version = null).also {
//         println("===installing")
//         it.dereferencer = ForeignEntityDereferencer(spec)
//     })
fun <T : Entity> referenceToExt(spec: EntitySpec<T>, id: String): Reference<T> {
    ForeignEntityFactory.check(spec.SCHEMA, id)
    return Reference<T>(
        spec,
        StorageReference(id, storageKey = ForeignStorageKey(spec.SCHEMA), version = null).also {
            it.dereferencer = ForeignEntityDereferencer(spec)
        })
}
